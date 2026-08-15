import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountInvitation,
  accountInvitationEvent,
  accountVerificationChallenge,
  auditLogs,
  crmContact,
  crmContactActivity,
  whatsappTemplate,
  type AccountInvitationRow,
} from "@/server/db/schema";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";
import { canManageInvitations } from "@/modules/invitation/domain/permissions";
import { ensureClaimedPersonaMembership } from "@/server/services/personas";
import {
  digestOtpCode,
  generateInvitationToken,
  generateOtpCode,
  hashInvitationToken,
  verifyOtpCode,
} from "@/server/invitation/crypto";
import {
  INVITATION_MAX_OTP_SENDS,
  INVITATION_MAX_SENDS,
  INVITATION_OTP_COOLDOWN_MS,
  INVITATION_OTP_MAX_ATTEMPTS,
  INVITATION_OTP_TEMPLATE_NAME,
  INVITATION_OTP_TTL_MS,
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_TOKEN_TTL_MS,
  INVITATION_WHATSAPP_TEMPLATE_NAME,
} from "@/server/invitation/config";
import {
  countInvitationEvents,
  getAcceptedAdmissionForContact,
  getInvitationByTokenHash,
  latestInvitationEventAt,
} from "@/server/queries/invitations";
import { normalizeWhatsAppPhone } from "@/server/whatsapp/phone";
import { sendWhatsAppTemplateCore } from "@/server/services/whatsapp";
import { env } from "@/server/env";

export type InvitationMutationResult =
  | { kind: "ok"; id: string }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "invalid_contact" }
  | { kind: "not_eligible" }
  | { kind: "no_phone" }
  | { kind: "already_linked" }
  | { kind: "conflict" }
  | { kind: "invalid_transition" }
  | { kind: "cooldown"; retryAfterSeconds: number }
  | { kind: "limit_reached" }
  | { kind: "expired" }
  | { kind: "invalid_token" }
  | { kind: "already_verified" }
  | { kind: "invalid_code" }
  | { kind: "locked" }
  | { kind: "no_account" }
  | { kind: "invalid_template" }
  | { kind: "not_configured" }
  | { kind: "provider_error"; providerErrorCode?: string | null; providerErrorMessage?: string | null }
  | { kind: "claim_conflict" };

export type InvitationPublicInfo = {
  status: string;
  intendedPersona: string;
  organizationName: string;
  maskedPhone: string;
  locale: string;
};

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function maskPhone(phone: string): string {
  if (phone.length <= 4) return `+${phone}`;
  const head = phone.slice(0, 3);
  const tail = phone.slice(-3);
  return `+${head}${"*".repeat(phone.length - 6)}${tail}`;
}

function isValidToken(token: string): boolean {
  return token.length >= 40 && token.length <= 200;
}

function buildInvitationLink(locale: string, token: string): string {
  return `${env.APP_URL}/${locale}/invitation?token=${encodeURIComponent(token)}`;
}

/** Resolves an APPROVED org-scoped template by name + language (never client-supplied template ids). */
async function resolveApprovedTemplate(
  client: DbClient,
  organizationId: string,
  name: string,
  language: string,
) {
  const [template] = await client
    .select()
    .from(whatsappTemplate)
    .where(and(eq(whatsappTemplate.organizationId, organizationId), eq(whatsappTemplate.name, name), eq(whatsappTemplate.language, language)))
    .limit(1);
  return template && template.status === "APPROVED" ? template : null;
}

/**
 * Creates a PENDING_SEND invitation for an accepted prospect. Nothing is sent
 * and no token exists yet — the token is generated at first send so a never-sent
 * invitation carries no usable credential. Enforces: contact exists + ACTIVE in
 * the org, has a usable WhatsApp phone, is not already linked to a user, is
 * eligible (ACCEPTED admission), and has no live invitation already.
 */
export async function createInvitation(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  data: { contactId: string; admissionId?: string | null; locale?: "fr" | "ar" },
): Promise<InvitationMutationResult> {
  if (!canManageInvitations(actorRole)) return { kind: "forbidden" };
  const locale = data.locale ?? "fr";

  return db.transaction(async (tx) => {
    const [contact] = await tx
      .select()
      .from(crmContact)
      .where(and(eq(crmContact.id, data.contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact || contact.status !== "ACTIVE") return { kind: "invalid_contact" };
    if (contact.linkedUserId) return { kind: "already_linked" };

    const destinationPhone = normalizeWhatsAppPhone(contact.phone);
    if (!destinationPhone) return { kind: "no_phone" };

    const accepted = await getAcceptedAdmissionForContact(organizationId, data.contactId);
    if (!accepted) return { kind: "not_eligible" };
    if (data.admissionId && data.admissionId !== accepted.id) return { kind: "not_eligible" };

    let row: AccountInvitationRow;
    try {
      [row] = await tx
        .insert(accountInvitation)
        .values({
          organizationId,
          contactId: data.contactId,
          admissionId: accepted.id,
          intendedPersona: "STUDENT",
          status: "PENDING_SEND",
          destinationPhone,
          locale,
          tokenVersion: 0,
          sendAttemptCount: 0,
          createdByUserId: actorUserId,
        })
        .returning();
    } catch {
      return { kind: "conflict" };
    }

    await tx.insert(accountInvitationEvent).values({ invitationId: row.id, eventType: "INVITATION_CREATED", metadata: { createdBy: actorUserId } });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.invitation.create",
      entityType: "account_invitation",
      entityId: row.id,
      metadata: { organizationId, contactId: data.contactId, admissionId: accepted.id },
    });
    return { kind: "ok", id: row.id };
  });
}

type SendAttempt =
  | { ok: true; invitation: AccountInvitationRow; version: number; token: string; templateId: string; requestId: string }
  | { ok: false; kind: Exclude<InvitationMutationResult["kind"], "ok">; retryAfterSeconds?: number };

/**
 * Prepares one send attempt atomically: advisory lock, state/cooldown/cap
 * checks, APPROVED template resolution, token generation (digest-only storage)
 * and the PENDING_SEND → SENT transition. The provider call happens AFTER this
 * transaction commits, mirroring the Phase 5 QUEUED-then-write-back discipline.
 */
async function prepareSendAttempt(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  invitationId: string,
): Promise<SendAttempt> {
  if (!canManageInvitations(actorRole)) return { ok: false, kind: "forbidden" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invitation:${invitationId}`}))`);

    const [invitation] = await tx
      .select()
      .from(accountInvitation)
      .where(and(eq(accountInvitation.id, invitationId), eq(accountInvitation.organizationId, organizationId)))
      .limit(1);
    if (!invitation) return { ok: false, kind: "not_found" };
    if (invitation.status !== "PENDING_SEND" && invitation.status !== "SENT") return { ok: false, kind: "invalid_transition" };

    const now = Date.now();
    if (invitation.lastSentAt) {
      const elapsed = now - invitation.lastSentAt.getTime();
      if (elapsed < INVITATION_RESEND_COOLDOWN_MS) {
        return { ok: false, kind: "cooldown", retryAfterSeconds: Math.max(1, Math.ceil((INVITATION_RESEND_COOLDOWN_MS - elapsed) / 1000)) };
      }
    }
    if (invitation.sendAttemptCount >= INVITATION_MAX_SENDS) return { ok: false, kind: "limit_reached" };

    const [contact] = await tx
      .select({ id: crmContact.id, linkedUserId: crmContact.linkedUserId })
      .from(crmContact)
      .where(eq(crmContact.id, invitation.contactId))
      .limit(1);
    if (!contact) return { ok: false, kind: "invalid_contact" };
    if (contact.linkedUserId) return { ok: false, kind: "already_linked" };

    const template = await resolveApprovedTemplate(tx, organizationId, INVITATION_WHATSAPP_TEMPLATE_NAME, invitation.locale);
    if (!template) return { ok: false, kind: "invalid_template" };

    const version = invitation.tokenVersion + 1;
    const token = generateInvitationToken();
    const sentAt = new Date();

    await tx
      .update(accountInvitation)
      .set({
        status: "SENT",
        tokenHash: hashInvitationToken(token),
        tokenVersion: version,
        tokenExpiresAt: new Date(now + INVITATION_TOKEN_TTL_MS),
        sentAt,
        lastSentAt: sentAt,
        sendAttemptCount: invitation.sendAttemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(accountInvitation.id, invitationId));

    return {
      ok: true,
      invitation,
      version,
      token,
      templateId: template.id,
      requestId: `inv:${invitationId}:v${version}`,
    };
  });
}

/**
 * Sends (first) or resends the invitation WhatsApp message with a fresh
 * token. The token is stored ONLY as a SHA-256 digest and embedded in the
 * message link. A failed send reverts the invitation to PENDING_SEND with no
 * usable token (INVITATION_SEND_FAILED event) while KEEPING the incremented
 * tokenVersion so the next attempt gets a fresh idempotency requestId.
 */
async function sendInvitationInternal(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  invitationId: string,
): Promise<InvitationMutationResult> {
  const attempt = await prepareSendAttempt(actorUserId, actorRole, organizationId, invitationId);
  if (!attempt.ok) {
    if (attempt.kind === "cooldown") return { kind: "cooldown", retryAfterSeconds: attempt.retryAfterSeconds! };
    return { kind: attempt.kind };
  }

  const sendResult = await sendWhatsAppTemplateCore(
    organizationId,
    {
      contactId: attempt.invitation.contactId,
      templateId: attempt.templateId,
      language: attempt.invitation.locale,
      parameters: [buildInvitationLink(attempt.invitation.locale, attempt.token)],
      requestId: attempt.requestId,
      destinationPhone: attempt.invitation.destinationPhone,
    },
    null,
  );

  if (sendResult.kind !== "ok") {
    await db.transaction(async (tx) => {
      await tx
        .update(accountInvitation)
        .set({ status: "PENDING_SEND", tokenHash: null, tokenExpiresAt: null, lastSentAt: new Date(), updatedAt: new Date() })
        .where(eq(accountInvitation.id, invitationId));
      await tx.insert(accountInvitationEvent).values({
        invitationId,
        eventType: "INVITATION_SEND_FAILED",
        metadata: { organizationId, tokenVersion: attempt.version, reason: sendResult.kind },
      });
      await tx.insert(auditLogs).values({
        actorUserId,
        action: "crm.invitation.send.failed",
        entityType: "account_invitation",
        entityId: invitationId,
        metadata: { organizationId, reason: sendResult.kind },
      });
    });
    if (sendResult.kind === "no_account") return { kind: "no_account" };
    if (sendResult.kind === "not_configured") return { kind: "not_configured" };
    if (sendResult.kind === "provider_error") {
      return { kind: "provider_error", providerErrorCode: sendResult.providerErrorCode, providerErrorMessage: sendResult.providerErrorMessage };
    }
    return { kind: "conflict" };
  }

  const isResend = attempt.invitation.status === "SENT";
  await db.transaction(async (tx) => {
    await tx.insert(accountInvitationEvent).values({
      invitationId,
      eventType: "INVITATION_SENT",
      metadata: { organizationId, tokenVersion: attempt.version, resend: isResend },
    });
    await tx.insert(crmContactActivity).values({
      contactId: attempt.invitation.contactId,
      actorUserId,
      type: "ACCOUNT_INVITATION_SENT",
      metadata: { invitationId, organizationId, resend: isResend },
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: isResend ? "crm.invitation.resend" : "crm.invitation.send",
      entityType: "account_invitation",
      entityId: invitationId,
      metadata: { organizationId, tokenVersion: attempt.version },
    });
  });
  return { kind: "ok", id: invitationId };
}

export async function sendInvitation(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  invitationId: string,
): Promise<InvitationMutationResult> {
  return sendInvitationInternal(actorUserId, actorRole, organizationId, invitationId);
}

export async function resendInvitation(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  invitationId: string,
): Promise<InvitationMutationResult> {
  return sendInvitationInternal(actorUserId, actorRole, organizationId, invitationId);
}

/**
 * Revokes a live invitation. The token digest is cleared (the link stops
 * resolving immediately) and any ACTIVE verification challenge is superseded.
 */
export async function revokeInvitation(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  invitationId: string,
): Promise<InvitationMutationResult> {
  if (!canManageInvitations(actorRole)) return { kind: "forbidden" };

  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(accountInvitation)
      .where(and(eq(accountInvitation.id, invitationId), eq(accountInvitation.organizationId, organizationId)))
      .limit(1);
    if (!invitation) return { kind: "not_found" };
    if (invitation.status !== "PENDING_SEND" && invitation.status !== "SENT" && invitation.status !== "VERIFIED") {
      return { kind: "invalid_transition" };
    }

    await tx
      .update(accountInvitation)
      .set({ status: "REVOKED", revokedAt: new Date(), tokenHash: null, tokenExpiresAt: null, updatedAt: new Date() })
      .where(eq(accountInvitation.id, invitationId));
    await tx
      .update(accountVerificationChallenge)
      .set({ status: "SUPERSEDED", updatedAt: new Date() })
      .where(and(eq(accountVerificationChallenge.invitationId, invitationId), eq(accountVerificationChallenge.status, "ACTIVE")));

    await tx.insert(accountInvitationEvent).values({ invitationId, eventType: "INVITATION_REVOKED", metadata: { organizationId, by: actorUserId } });
    await tx.insert(crmContactActivity).values({
      contactId: invitation.contactId,
      actorUserId,
      type: "ACCOUNT_INVITATION_REVOKED",
      metadata: { invitationId, organizationId },
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.invitation.revoke",
      entityType: "account_invitation",
      entityId: invitationId,
      metadata: { organizationId },
    });
    return { kind: "ok", id: invitationId };
  });
}

/**
 * Public, read-only invitation detail for the invitation landing page. Only a
 * masked destination phone is exposed. Token lookup is by digest; an unknown
 * token and a malformed token both resolve to the same controlled error (no
 * enumeration).
 */
export async function getInvitationPublicInfo(token: string): Promise<InvitationMutationResult & { info?: InvitationPublicInfo }> {
  if (!isValidToken(token)) return { kind: "invalid_token" };
  const resolved = await getInvitationByTokenHash(hashInvitationToken(token));
  if (!resolved) return { kind: "invalid_token" };

  const invitation = resolved.invitation;
  let status = invitation.status;
  if ((invitation.status === "SENT" || invitation.status === "VERIFIED") && invitation.tokenExpiresAt && invitation.tokenExpiresAt.getTime() <= Date.now()) {
    status = "EXPIRED";
  }

  return {
    kind: "ok",
    id: invitation.id,
    info: {
      status,
      intendedPersona: invitation.intendedPersona,
      organizationName: resolved.organization.name,
      maskedPhone: maskPhone(invitation.destinationPhone),
      locale: invitation.locale,
    },
  };
}

/**
 * Sends a fresh OTP to the invitation's destination snapshot. The code is
 * generated here, transmitted by WhatsApp, and stored ONLY as a keyed
 * HMAC-SHA256 digest. One ACTIVE challenge per invitation (DB partial unique):
 * a new request supersedes the previous challenge. Cooldown and a per-
 * invitation send cap apply before any challenge is created.
 */
export async function requestVerificationCode(token: string): Promise<InvitationMutationResult> {
  if (!isValidToken(token)) return { kind: "invalid_token" };
  const resolved = await getInvitationByTokenHash(hashInvitationToken(token));
  if (!resolved) return { kind: "invalid_token" };

  const invitation = resolved.invitation;
  if (invitation.status === "VERIFIED") return { kind: "already_verified" };
  if (invitation.status !== "SENT") return { kind: "invalid_transition" };
  if (invitation.tokenExpiresAt && invitation.tokenExpiresAt.getTime() <= Date.now()) return { kind: "expired" };

  const otpSentCount = await countInvitationEvents(invitation.id, "OTP_SENT");
  if (otpSentCount >= INVITATION_MAX_OTP_SENDS) return { kind: "limit_reached" };
  const lastOtpAt = await latestInvitationEventAt(invitation.id, "OTP_SENT");
  if (lastOtpAt) {
    const elapsed = Date.now() - lastOtpAt.getTime();
    if (elapsed < INVITATION_OTP_COOLDOWN_MS) {
      return { kind: "cooldown", retryAfterSeconds: Math.max(1, Math.ceil((INVITATION_OTP_COOLDOWN_MS - elapsed) / 1000)) };
    }
  }

  const template = await resolveApprovedTemplate(db, invitation.organizationId, INVITATION_OTP_TEMPLATE_NAME, invitation.locale);
  if (!template) return { kind: "invalid_template" };

  const code = generateOtpCode();
  const challengeId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(accountVerificationChallenge)
        .set({ status: "SUPERSEDED", updatedAt: new Date() })
        .where(and(eq(accountVerificationChallenge.invitationId, invitation.id), eq(accountVerificationChallenge.status, "ACTIVE")));
      await tx.insert(accountVerificationChallenge).values({
        id: challengeId,
        invitationId: invitation.id,
        codeHash: digestOtpCode(invitation.id, challengeId, code),
        status: "ACTIVE",
        attemptCount: 0,
        maxAttempts: INVITATION_OTP_MAX_ATTEMPTS,
        expiresAt: new Date(Date.now() + INVITATION_OTP_TTL_MS),
      });
    });
  } catch {
    return { kind: "conflict" };
  }

  const sendResult = await sendWhatsAppTemplateCore(
    invitation.organizationId,
    {
      contactId: invitation.contactId,
      templateId: template.id,
      language: invitation.locale,
      parameters: [code],
      requestId: `inv-otp:${invitation.id}:${challengeId}`,
      destinationPhone: invitation.destinationPhone,
    },
    null,
  );

  if (sendResult.kind !== "ok") {
    // The code was never delivered — expire the challenge so no stale ACTIVE
    // challenge can consume the attempt budget.
    await db
      .update(accountVerificationChallenge)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(accountVerificationChallenge.id, challengeId), eq(accountVerificationChallenge.status, "ACTIVE")));
    if (sendResult.kind === "no_account") return { kind: "no_account" };
    if (sendResult.kind === "not_configured") return { kind: "not_configured" };
    if (sendResult.kind === "provider_error") {
      return { kind: "provider_error", providerErrorCode: sendResult.providerErrorCode, providerErrorMessage: sendResult.providerErrorMessage };
    }
    return { kind: "conflict" };
  }

  await db.insert(accountInvitationEvent).values({ invitationId: invitation.id, eventType: "OTP_SENT", metadata: { challengeId } });
  return { kind: "ok", id: challengeId };
}

/**
 * Verifies a presented OTP against the invitation's ACTIVE challenge. Wrong
 * codes consume the bounded attempt budget (LOCKED at exhaustion); a correct
 * code transitions the invitation SENT → VERIFIED and records the PHONE_VERIFIED
 * milestone. The invitation is NOT authenticated and NO account/session is
 * created — only the claim step (with a real Better Auth session) links a user.
 */
export async function verifyVerificationCode(token: string, code: string): Promise<InvitationMutationResult> {
  if (!isValidToken(token)) return { kind: "invalid_token" };
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return { kind: "invalid_code" };
  const resolved = await getInvitationByTokenHash(hashInvitationToken(token));
  if (!resolved) return { kind: "invalid_token" };

  const invitation = resolved.invitation;
  if (invitation.status === "VERIFIED") return { kind: "already_verified" };
  if (invitation.status !== "SENT") return { kind: "invalid_transition" };
  if (invitation.tokenExpiresAt && invitation.tokenExpiresAt.getTime() <= Date.now()) return { kind: "expired" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invitation-otp:${invitation.id}`}))`);

    const [challenge] = await tx
      .select()
      .from(accountVerificationChallenge)
      .where(eq(accountVerificationChallenge.invitationId, invitation.id))
      .orderBy(desc(accountVerificationChallenge.createdAt))
      .limit(1);
    if (!challenge) return { kind: "invalid_code" };
    if (challenge.status === "LOCKED") return { kind: "locked" };
    if (challenge.status !== "ACTIVE") return { kind: "invalid_code" };
    if (challenge.expiresAt.getTime() <= Date.now()) {
      await tx
        .update(accountVerificationChallenge)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(eq(accountVerificationChallenge.id, challenge.id));
      return { kind: "expired" };
    }

    const correct = verifyOtpCode(invitation.id, challenge.id, code, challenge.codeHash);
    if (!correct) {
      const nextAttempts = challenge.attemptCount + 1;
      await tx
        .update(accountVerificationChallenge)
        .set({
          status: nextAttempts >= challenge.maxAttempts ? "LOCKED" : challenge.status,
          attemptCount: nextAttempts,
          updatedAt: new Date(),
        })
        .where(eq(accountVerificationChallenge.id, challenge.id));
      return { kind: "invalid_code" };
    }

    await tx
      .update(accountVerificationChallenge)
      .set({ status: "VERIFIED", verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(accountVerificationChallenge.id, challenge.id));
    await tx
      .update(accountInvitation)
      .set({ status: "VERIFIED", phoneVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(accountInvitation.id, invitation.id));

    await tx.insert(accountInvitationEvent).values({ invitationId: invitation.id, eventType: "PHONE_VERIFIED", metadata: { challengeId: challenge.id } });
    await tx.insert(crmContactActivity).values({
      contactId: invitation.contactId,
      actorUserId: null,
      type: "PHONE_VERIFIED",
      metadata: { invitationId: invitation.id, organizationId: invitation.organizationId },
    });
    await tx.insert(auditLogs).values({
      actorUserId: null,
      action: "crm.invitation.phone.verified",
      entityType: "account_invitation",
      entityId: invitation.id,
      metadata: { organizationId: invitation.organizationId },
    });
    return { kind: "ok", id: invitation.id };
  });
}

/**
 * Authenticated claim: links the verified invitation's contact to the SESSION
 * user (the user id comes from the session, never the request body), consumes
 * the invitation, and ensures the STUDENT persona. Idempotent for the same
 * user; a contact already linked to a DIFFERENT user is a conflict. Uses an
 * advisory lock + row-level re-checks so concurrent claims cannot double-
 * consume or double-link.
 */
export async function claimInvitation(userId: string, token: string): Promise<InvitationMutationResult> {
  if (!isValidToken(token)) return { kind: "invalid_token" };
  const resolved = await getInvitationByTokenHash(hashInvitationToken(token));
  if (!resolved) return { kind: "invalid_token" };

  const invitation = resolved.invitation;
  if (invitation.status === "CONSUMED") {
    return resolved.contact.linkedUserId === userId ? { kind: "ok", id: invitation.id } : { kind: "claim_conflict" };
  }
  if (invitation.status !== "VERIFIED") return { kind: "invalid_transition" };
  if (invitation.tokenExpiresAt && invitation.tokenExpiresAt.getTime() <= Date.now()) return { kind: "expired" };
  if (resolved.contact.linkedUserId && resolved.contact.linkedUserId !== userId) return { kind: "claim_conflict" };

  const claim = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invitation-claim:${invitation.id}`}))`);

    const [current] = await tx
      .select()
      .from(accountInvitation)
      .where(eq(accountInvitation.id, invitation.id))
      .limit(1);
    if (!current) return { kind: "not_found" as const };
    if (current.status === "CONSUMED") {
      return { idempotent: true as const, contactId: current.contactId };
    }
    if (current.status !== "VERIFIED") return { kind: "invalid_transition" as const };
    if (current.tokenExpiresAt && current.tokenExpiresAt.getTime() <= Date.now()) return { kind: "expired" as const };

    const [contact] = await tx
      .select()
      .from(crmContact)
      .where(eq(crmContact.id, current.contactId))
      .for("update")
      .limit(1);
    if (!contact) return { kind: "invalid_contact" as const };
    if (contact.linkedUserId && contact.linkedUserId !== userId) return { kind: "claim_conflict" as const };

    try {
      await tx
        .update(crmContact)
        .set({ linkedUserId: userId, updatedAt: new Date() })
        .where(eq(crmContact.id, contact.id));
    } catch {
      return { kind: "claim_conflict" as const };
    }
    await tx
      .update(accountInvitation)
      .set({ status: "CONSUMED", consumedAt: new Date(), updatedAt: new Date() })
      .where(eq(accountInvitation.id, invitation.id));

    await tx.insert(accountInvitationEvent).values({ invitationId: invitation.id, eventType: "INVITATION_CONSUMED", metadata: { userId } });
    await tx.insert(crmContactActivity).values({
      contactId: contact.id,
      actorUserId: userId,
      type: "ACCOUNT_LINKED",
      metadata: { invitationId: invitation.id, organizationId: current.organizationId },
    });
    await tx.insert(auditLogs).values({
      actorUserId: userId,
      action: "crm.invitation.claim",
      entityType: "account_invitation",
      entityId: invitation.id,
      metadata: { organizationId: current.organizationId, contactId: contact.id },
    });
    return { ok: true as const, id: invitation.id };
  });

  if ("ok" in claim && claim.ok) {
    await ensureClaimedPersonaMembership(userId, "STUDENT");
    return { kind: "ok", id: claim.id };
  }
  if ("idempotent" in claim && claim.idempotent) {
    // A prior claim by the same user already consumed this invitation.
    await ensureClaimedPersonaMembership(userId, "STUDENT");
    return { kind: "ok", id: invitation.id };
  }
  return claim;
}

export type { AccountInvitationRow };