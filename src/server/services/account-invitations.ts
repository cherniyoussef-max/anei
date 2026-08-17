import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountInvitation,
  accountInvitationEvent,
  accountVerificationChallenge,
  admission,
  auditLogs,
  crmContact,
  crmContactActivity,
  organization,
  type AccountInvitationRow,
} from "@/server/db/schema";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";
import { canContactBeInvited } from "@/server/services/admissions";
import { canManageInvitations, type AccountInvitationEventType } from "@/modules/account-invitation/domain/permissions";
import { ensureStudentPersonaMembership } from "@/server/services/personas";
import { getWhatsAppAccountForOrg, getApprovedWhatsAppTemplateByName } from "@/server/queries/whatsapp";
import { getAdmissionForContact } from "@/server/queries/admission";
import { normalizeWhatsAppPhone } from "@/server/whatsapp/phone";
import { enqueueSystemWhatsAppTemplateWithSecretParameters } from "@/server/services/whatsapp";
import { env } from "@/server/env";
import {
  digestsEqual,
  generateInvitationToken,
  generateOtp,
  hashInvitationToken,
  hashOtp,
  INVITATION_TOKEN_TTL_HOURS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
} from "@/server/security/invitation-crypto";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const INVITATION_TEMPLATE_NAME = "account_invitation";
const OTP_TEMPLATE_NAME = "otp_verification";
const DEFAULT_LOCALE = "fr";
const RESEND_MAX_PER_DAY = 5;
const OTP_SEND_MAX_PER_DAY = 8;

async function logEvent(
  tx: DbClient,
  invitationId: string,
  actorUserId: string | null,
  eventType: AccountInvitationEventType,
  metadata?: Record<string, unknown>,
) {
  await tx.insert(accountInvitationEvent).values({ invitationId, actorUserId, eventType, metadata });
}

async function logContactActivity(
  tx: DbClient,
  contactId: string,
  actorUserId: string | null,
  type: "ACCOUNT_INVITATION_SENT" | "PHONE_VERIFIED" | "ACCOUNT_LINKED" | "ACCOUNT_INVITATION_REVOKED",
  metadata?: Record<string, unknown>,
) {
  await tx.insert(crmContactActivity).values({ contactId, actorUserId, type, metadata });
}

// --- Eligibility (server-reloaded, never trusts the browser) -----------------------------

export type EligibilityResult =
  | { kind: "eligible"; admissionId: string; normalizedPhone: string }
  | { kind: "not_found" }
  | { kind: "not_eligible" }
  | { kind: "already_linked" }
  | { kind: "no_phone" }
  | { kind: "not_configured" };

/**
 * Reloads every eligibility fact server-side: reuses Phase 4's
 * `canContactBeInvited` (ACTIVE contact + ACCEPTED admission), then adds the
 * Phase 6-specific requirements (not already linked, usable phone, an
 * ACTIVE WhatsApp account, and an APPROVED invitation template) for the
 * organization. Never trusts a client-supplied eligible/accepted flag.
 */
export async function evaluateInvitationEligibility(organizationId: string, contactId: string): Promise<EligibilityResult> {
  const [contact] = await db
    .select({ id: crmContact.id, status: crmContact.status, phone: crmContact.phone, linkedUserId: crmContact.linkedUserId })
    .from(crmContact)
    .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
    .limit(1);
  if (!contact) return { kind: "not_found" };
  if (contact.linkedUserId) return { kind: "already_linked" };

  const eligible = await canContactBeInvited(organizationId, contactId);
  if (!eligible) return { kind: "not_eligible" };

  const normalizedPhone = normalizeWhatsAppPhone(contact.phone);
  if (!normalizedPhone) return { kind: "no_phone" };

  const account = await getWhatsAppAccountForOrg(organizationId);
  if (!account || account.status !== "ACTIVE") return { kind: "not_configured" };

  const invitationTemplate = await getApprovedWhatsAppTemplateByName(organizationId, INVITATION_TEMPLATE_NAME, DEFAULT_LOCALE);
  if (!invitationTemplate) return { kind: "not_configured" };

  const admissionRow = await getAdmissionForContact(organizationId, contactId);
  if (!admissionRow || admissionRow.decision !== "ACCEPTED") return { kind: "not_eligible" };

  return { kind: "eligible", admissionId: admissionRow.id, normalizedPhone };
}

// --- Admin: create / resend / revoke ------------------------------------------------------

export type InvitationMutationResult =
  | { kind: "ok"; id: string; sent: boolean }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "not_eligible" }
  | { kind: "already_linked" }
  | { kind: "no_phone" }
  | { kind: "not_configured" }
  | { kind: "conflict" }
  | { kind: "invalid_transition" }
  | { kind: "send_cooldown" }
  | { kind: "send_limit" };

/** Creates a PENDING_SEND invitation, then attempts delivery (never inside the same DB transaction as the create). */
export async function createAccountInvitation(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  contactId: string,
): Promise<InvitationMutationResult> {
  if (!canManageInvitations(actorRole)) return { kind: "forbidden" };

  const eligibility = await evaluateInvitationEligibility(organizationId, contactId);
  if (eligibility.kind !== "eligible") return eligibility;

  const rawToken = generateInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const tokenExpiresAt = new Date(Date.now() + INVITATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  let invitationId: string;
  try {
    invitationId = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: accountInvitation.id })
        .from(accountInvitation)
        .where(eq(accountInvitation.contactId, contactId))
        .for("update")
        .limit(1);
      if (existing) throw new InvitationConflict();

      const [row] = await tx
        .insert(accountInvitation)
        .values({
          organizationId,
          contactId,
          admissionId: eligibility.admissionId,
          destinationPhone: eligibility.normalizedPhone,
          tokenHash,
          tokenExpiresAt,
          createdByUserId: actorUserId,
        })
        .returning({ id: accountInvitation.id });
      await logEvent(tx, row.id, actorUserId, "INVITATION_CREATED", { organizationId });
      await tx.insert(auditLogs).values({
        actorUserId,
        action: "account_invitation.create",
        entityType: "account_invitation",
        entityId: row.id,
        metadata: { organizationId, contactId },
      });
      return row.id;
    });
  } catch (error) {
    if (error instanceof InvitationConflict) return { kind: "conflict" };
    throw error;
  }

  const sent = await attemptDelivery(actorUserId, organizationId, invitationId, rawToken, "INVITATION_SENT", "INVITATION_SEND_FAILED");
  return { kind: "ok", id: invitationId, sent };
}

/** Rotates the invitation's secret and re-attempts delivery. Old tokens are invalidated by construction (tokenHash changes). */
export async function resendAccountInvitation(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  contactId: string,
): Promise<InvitationMutationResult> {
  if (!canManageInvitations(actorRole)) return { kind: "forbidden" };

  const rawToken = generateInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const tokenExpiresAt = new Date(Date.now() + INVITATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  let invitationId: string;
  try {
    invitationId = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${contactId}))`);
      const [existing] = await tx
        .select({
          id: accountInvitation.id,
          organizationId: accountInvitation.organizationId,
          status: accountInvitation.status,
        })
        .from(accountInvitation)
        .where(eq(accountInvitation.contactId, contactId))
        .limit(1);
      if (!existing || existing.organizationId !== organizationId) throw new NotFound();
      if (existing.status !== "PENDING_SEND" && existing.status !== "SENT" && existing.status !== "SEND_FAILED") {
        throw new InvalidTransition();
      }

      const recentResendCount = await tx
        .select({ createdAt: accountInvitationEvent.createdAt })
        .from(accountInvitationEvent)
        .where(and(eq(accountInvitationEvent.invitationId, existing.id), eq(accountInvitationEvent.eventType, "INVITATION_RESENT")));
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentToday = recentResendCount.filter((row) => row.createdAt.getTime() > dayAgo);
      if (recentToday.length >= RESEND_MAX_PER_DAY) throw new SendLimit();
      const lastResendAt = recentToday.map((row) => row.createdAt.getTime()).sort((a, b) => b - a)[0];
      if (lastResendAt && Date.now() - lastResendAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) throw new SendCooldown();

      await tx
        .update(accountInvitation)
        .set({ tokenHash, tokenExpiresAt, tokenVersion: sql`${accountInvitation.tokenVersion} + 1`, updatedAt: new Date() })
        .where(eq(accountInvitation.id, existing.id));
      await logEvent(tx, existing.id, actorUserId, "INVITATION_RESENT", { organizationId });
      await tx.insert(auditLogs).values({
        actorUserId,
        action: "account_invitation.resend",
        entityType: "account_invitation",
        entityId: existing.id,
        metadata: { organizationId, contactId },
      });
      return existing.id;
    });
  } catch (error) {
    if (error instanceof NotFound) return { kind: "not_found" };
    if (error instanceof InvalidTransition) return { kind: "invalid_transition" };
    if (error instanceof SendLimit) return { kind: "send_limit" };
    if (error instanceof SendCooldown) return { kind: "send_cooldown" };
    throw error;
  }

  const sent = await attemptDelivery(actorUserId, organizationId, invitationId, rawToken, "INVITATION_SENT", "INVITATION_SEND_FAILED");
  return { kind: "ok", id: invitationId, sent };
}

export async function revokeAccountInvitation(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  contactId: string,
): Promise<InvitationMutationResult> {
  if (!canManageInvitations(actorRole)) return { kind: "forbidden" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: accountInvitation.id, organizationId: accountInvitation.organizationId, status: accountInvitation.status })
      .from(accountInvitation)
      .where(eq(accountInvitation.contactId, contactId))
      .limit(1);
    if (!existing || existing.organizationId !== organizationId) return { kind: "not_found" };
    if (existing.status === "REVOKED" || existing.status === "CONSUMED" || existing.status === "EXPIRED") {
      return { kind: "invalid_transition" };
    }

    await tx.update(accountInvitation).set({ status: "REVOKED", revokedAt: new Date(), updatedAt: new Date() }).where(eq(accountInvitation.id, existing.id));
    await tx
      .update(accountVerificationChallenge)
      .set({ status: "SUPERSEDED" })
      .where(and(eq(accountVerificationChallenge.invitationId, existing.id), eq(accountVerificationChallenge.status, "ACTIVE")));
    await logEvent(tx, existing.id, actorUserId, "INVITATION_REVOKED", { organizationId });
    await logContactActivity(tx, contactId, actorUserId, "ACCOUNT_INVITATION_REVOKED");
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "account_invitation.revoke",
      entityType: "account_invitation",
      entityId: existing.id,
      metadata: { organizationId, contactId },
    });
    return { kind: "ok", id: existing.id, sent: false };
  });
}

/**
 * WhatsApp delivery of the invitation link. Phase 9 model: the invitation
 * status mutation (SENT / SEND_FAILED) and the outbox dispatch intent
 * (`WHATSAPP_TEMPLATE_SEND`) commit in ONE transaction (see
 * docs/premium/PHASE9_HANDOFF.md — the provider call itself never runs here;
 * it happens later in the worker). Keyed by a deterministic requestId derived
 * from the invitation id + token version, so an HTTP retry of the same logical
 * send attempt never re-enqueues a second job. The raw token appears only
 * inside the invitation URL, which is AES-256-GCM encrypted at rest in the
 * message's `bodyParametersEncrypted` (never plaintext, never in the outbox
 * payload, never logged).
 */
async function attemptDelivery(
  actorUserId: string,
  organizationId: string,
  invitationId: string,
  rawToken: string,
  sentEvent: AccountInvitationEventType,
  failedEvent: AccountInvitationEventType,
): Promise<boolean> {
  const [invitation] = await db
    .select({ contactId: accountInvitation.contactId, tokenVersion: accountInvitation.tokenVersion })
    .from(accountInvitation)
    .where(eq(accountInvitation.id, invitationId))
    .limit(1);
  if (!invitation) return false;

  const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, organizationId)).limit(1);
  const template = await getApprovedWhatsAppTemplateByName(organizationId, INVITATION_TEMPLATE_NAME, DEFAULT_LOCALE);
  const invitationUrl = `${env.APP_URL}/${DEFAULT_LOCALE}/invitation/${encodeURIComponent(rawToken)}`;

  let sent = false;
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: accountInvitation.status }).from(accountInvitation).where(eq(accountInvitation.id, invitationId)).limit(1);
    if (!current || current.status === "VERIFIED" || current.status === "CONSUMED" || current.status === "REVOKED") return;

    if (template) {
      const result = await enqueueSystemWhatsAppTemplateWithSecretParameters(
        organizationId,
        {
          contactId: invitation.contactId,
          templateId: template.id,
          language: template.language,
          parameters: [org?.name ?? "ANEI", invitationUrl],
          requestId: `account-invitation:${invitationId}:v${invitation.tokenVersion}`,
        },
        tx,
      );
      sent = result.kind === "ok";
    }

    await tx.update(accountInvitation).set({ status: sent ? "SENT" : "SEND_FAILED", sentAt: sent ? new Date() : undefined, updatedAt: new Date() }).where(eq(accountInvitation.id, invitationId));
    await logEvent(tx, invitationId, actorUserId, sent ? sentEvent : failedEvent, { organizationId });
    if (sent) await logContactActivity(tx, invitation.contactId, actorUserId, "ACCOUNT_INVITATION_SENT");
  });

  return sent;
}

// --- Public: OTP request / verify ---------------------------------------------------------

export type OtpRequestResult =
  | { kind: "ok" }
  | { kind: "invalid_invitation" }
  | { kind: "invitation_expired" }
  | { kind: "invitation_revoked" }
  | { kind: "already_consumed" }
  | { kind: "not_eligible" }
  | { kind: "not_configured" }
  | { kind: "send_cooldown" }
  | { kind: "send_limit" };

/** Destination is always `invitation.destinationPhone`, resolved server-side — the caller supplies only the invitation token. */
export async function requestInvitationOtp(rawToken: string): Promise<OtpRequestResult> {
  const tokenHash = hashInvitationToken(rawToken);
  const [invitation] = await db.select().from(accountInvitation).where(eq(accountInvitation.tokenHash, tokenHash)).limit(1);
  if (!invitation) return { kind: "invalid_invitation" };

  const outer = classifyInvitationForPublicUse(invitation);
  if (outer) return outer;
  if (invitation.status !== "SENT") return { kind: "not_eligible" };

  const org = await getWhatsAppAccountForOrg(invitation.organizationId);
  if (!org || org.status !== "ACTIVE") return { kind: "not_configured" };
  const template = await getApprovedWhatsAppTemplateByName(invitation.organizationId, OTP_TEMPLATE_NAME, DEFAULT_LOCALE);
  if (!template) return { kind: "not_configured" };

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${invitation.id}))`);

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentChallenges = await tx
        .select({ createdAt: accountVerificationChallenge.createdAt })
        .from(accountVerificationChallenge)
        .where(eq(accountVerificationChallenge.invitationId, invitation.id));
      const todayCount = recentChallenges.filter((row) => row.createdAt >= dayAgo).length;
      if (todayCount >= OTP_SEND_MAX_PER_DAY) throw new SendLimit();
      const lastCreatedAt = recentChallenges.map((row) => row.createdAt.getTime()).sort((a, b) => b - a)[0];
      if (lastCreatedAt && Date.now() - lastCreatedAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) throw new SendCooldown();

      // Supersede any prior ACTIVE challenge — concurrent requests are
      // serialized by the advisory lock above, so at most one ACTIVE
      // challenge ever exists per invitation, DB-enforced by the partial
      // unique index as a backstop.
      await tx
        .update(accountVerificationChallenge)
        .set({ status: "SUPERSEDED" })
        .where(and(eq(accountVerificationChallenge.invitationId, invitation.id), eq(accountVerificationChallenge.status, "ACTIVE")));

      const generatedOtp = generateOtp();
      const [challenge] = await tx
        .insert(accountVerificationChallenge)
        .values({
          invitationId: invitation.id,
          codeHash: "pending",
          expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
        })
        .returning({ id: accountVerificationChallenge.id });
      await tx
        .update(accountVerificationChallenge)
        .set({ codeHash: hashOtp(challenge.id, generatedOtp) })
        .where(eq(accountVerificationChallenge.id, challenge.id));

      await logEvent(tx, invitation.id, null, "OTP_SENT", { organizationId: invitation.organizationId });

      // Phase 9: the challenge mutation and the durable outbox dispatch intent
      // commit in ONE transaction (docs/premium/PHASE9_HANDOFF.md). The OTP is
      // never persisted raw — it is AES-256-GCM encrypted at rest in the
      // message's bodyParametersEncrypted and the worker decrypts it only when
      // it performs the provider call.
      await enqueueSystemWhatsAppTemplateWithSecretParameters(
        invitation.organizationId,
        {
          contactId: invitation.contactId,
          templateId: template.id,
          language: template.language,
          parameters: [generatedOtp],
          requestId: `account-invitation-otp:${challenge.id}`,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof SendLimit) return { kind: "send_limit" };
    if (error instanceof SendCooldown) return { kind: "send_cooldown" };
    throw error;
  }

  return { kind: "ok" };
}

export type OtpVerifyResult =
  | { kind: "ok" }
  | { kind: "already_verified" }
  | { kind: "invalid_invitation" }
  | { kind: "invitation_expired" }
  | { kind: "invitation_revoked" }
  | { kind: "already_consumed" }
  | { kind: "not_eligible" }
  | { kind: "invalid_code" }
  | { kind: "code_expired" }
  | { kind: "attempts_exhausted" };

export async function verifyInvitationOtp(rawToken: string, code: string): Promise<OtpVerifyResult> {
  const tokenHash = hashInvitationToken(rawToken);
  const [invitation] = await db.select().from(accountInvitation).where(eq(accountInvitation.tokenHash, tokenHash)).limit(1);
  if (!invitation) return { kind: "invalid_invitation" };
  if (invitation.status === "VERIFIED") return { kind: "already_verified" };

  const outer = classifyInvitationForPublicUse(invitation);
  if (outer) return outer;
  if (invitation.status !== "SENT") return { kind: "not_eligible" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${invitation.id}))`);

    const [freshInvitation] = await tx.select({ status: accountInvitation.status }).from(accountInvitation).where(eq(accountInvitation.id, invitation.id)).limit(1);
    if (!freshInvitation) return { kind: "invalid_invitation" as const };
    if (freshInvitation.status === "VERIFIED") return { kind: "already_verified" as const };
    if (freshInvitation.status !== "SENT") return { kind: "not_eligible" as const };

    const [challenge] = await tx
      .select()
      .from(accountVerificationChallenge)
      .where(and(eq(accountVerificationChallenge.invitationId, invitation.id), eq(accountVerificationChallenge.status, "ACTIVE")))
      .limit(1);
    if (!challenge) return { kind: "not_eligible" as const };

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await tx.update(accountVerificationChallenge).set({ status: "EXPIRED" }).where(eq(accountVerificationChallenge.id, challenge.id));
      return { kind: "code_expired" as const };
    }
    if (challenge.attemptCount >= challenge.maxAttempts) {
      await tx.update(accountVerificationChallenge).set({ status: "LOCKED" }).where(eq(accountVerificationChallenge.id, challenge.id));
      return { kind: "attempts_exhausted" as const };
    }

    const candidateHash = hashOtp(challenge.id, code);
    if (!digestsEqual(candidateHash, challenge.codeHash)) {
      const nextAttemptCount = challenge.attemptCount + 1;
      await tx
        .update(accountVerificationChallenge)
        .set({ attemptCount: nextAttemptCount, status: nextAttemptCount >= challenge.maxAttempts ? "LOCKED" : "ACTIVE" })
        .where(eq(accountVerificationChallenge.id, challenge.id));
      return nextAttemptCount >= challenge.maxAttempts ? { kind: "attempts_exhausted" as const } : { kind: "invalid_code" as const };
    }

    await tx.update(accountVerificationChallenge).set({ status: "VERIFIED", verifiedAt: new Date() }).where(eq(accountVerificationChallenge.id, challenge.id));
    await tx.update(accountInvitation).set({ status: "VERIFIED", phoneVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(accountInvitation.id, invitation.id));
    await logEvent(tx, invitation.id, null, "PHONE_VERIFIED", { organizationId: invitation.organizationId });
    await logContactActivity(tx, invitation.contactId, null, "PHONE_VERIFIED");
    return { kind: "ok" as const };
  });
}

// --- Authenticated claim -------------------------------------------------------------------

export type ClaimResult =
  | { kind: "ok" }
  | { kind: "invalid_invitation" }
  | { kind: "invitation_expired" }
  | { kind: "invitation_revoked" }
  | { kind: "not_verified" }
  | { kind: "already_consumed" }
  | { kind: "not_eligible" }
  | { kind: "link_conflict" };

/**
 * Consumes a VERIFIED invitation for the AUTHENTICATED claimant (userId
 * comes only from the caller's own session — see the route handler, never
 * from a request body field). One-time and concurrency-safe: the advisory
 * lock keyed on the invitation id serializes concurrent claim attempts for
 * the same invitation, and the pre-existing `crm_contact_org_linked_user_
 * unique` constraint (Phase 3) is the DB-authoritative backstop against two
 * different users ever linking the same contact.
 */
export async function claimAccountInvitation(claimantUserId: string, rawToken: string): Promise<ClaimResult> {
  const tokenHash = hashInvitationToken(rawToken);
  const [invitation] = await db.select().from(accountInvitation).where(eq(accountInvitation.tokenHash, tokenHash)).limit(1);
  if (!invitation) return { kind: "invalid_invitation" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${invitation.id}))`);

    const [fresh] = await tx.select().from(accountInvitation).where(eq(accountInvitation.id, invitation.id)).limit(1);
    if (!fresh) return { kind: "invalid_invitation" as const };

    if (fresh.status === "CONSUMED") {
      const [contact] = await tx.select({ linkedUserId: crmContact.linkedUserId }).from(crmContact).where(eq(crmContact.id, fresh.contactId)).limit(1);
      return contact?.linkedUserId === claimantUserId ? { kind: "ok" as const } : { kind: "already_consumed" as const };
    }
    if (fresh.status === "REVOKED") return { kind: "invitation_revoked" as const };
    if (fresh.status === "EXPIRED") return { kind: "invitation_expired" as const };
    if (fresh.status !== "VERIFIED") return { kind: "not_verified" as const };
    if (fresh.tokenExpiresAt.getTime() <= Date.now()) {
      await tx.update(accountInvitation).set({ status: "EXPIRED", updatedAt: new Date() }).where(eq(accountInvitation.id, fresh.id));
      return { kind: "invitation_expired" as const };
    }

    const [contact] = await tx
      .select({ id: crmContact.id, status: crmContact.status, linkedUserId: crmContact.linkedUserId })
      .from(crmContact)
      .where(and(eq(crmContact.id, fresh.contactId), eq(crmContact.organizationId, fresh.organizationId)))
      .limit(1);
    if (!contact || contact.status !== "ACTIVE") return { kind: "not_eligible" as const };
    if (contact.linkedUserId && contact.linkedUserId !== claimantUserId) return { kind: "link_conflict" as const };

    const [admissionRow] = await tx
      .select({ decision: admission.decision })
      .from(admission)
      .where(and(eq(admission.id, fresh.admissionId), eq(admission.organizationId, fresh.organizationId)))
      .limit(1);
    if (!admissionRow || admissionRow.decision !== "ACCEPTED") return { kind: "not_eligible" as const };

    if (!contact.linkedUserId) {
      try {
        await tx.update(crmContact).set({ linkedUserId: claimantUserId, updatedAt: new Date() }).where(eq(crmContact.id, contact.id));
      } catch {
        return { kind: "link_conflict" as const };
      }
      await tx.insert(crmContactActivity).values({ contactId: contact.id, actorUserId: claimantUserId, type: "USER_LINKED", metadata: { linkedUserId: claimantUserId } });
    }

    await ensureStudentPersonaMembership(tx, claimantUserId);

    await tx.update(accountInvitation).set({ status: "CONSUMED", consumedAt: new Date(), updatedAt: new Date() }).where(eq(accountInvitation.id, fresh.id));
    await logEvent(tx, fresh.id, claimantUserId, "INVITATION_CONSUMED", { organizationId: fresh.organizationId });
    await logContactActivity(tx, contact.id, claimantUserId, "ACCOUNT_LINKED");
    await tx.insert(auditLogs).values({
      actorUserId: claimantUserId,
      action: "account_invitation.claim",
      entityType: "account_invitation",
      entityId: fresh.id,
      metadata: { organizationId: fresh.organizationId, contactId: contact.id },
    });
    return { kind: "ok" as const };
  });
}

// --- Public landing (minimal disclosure) ----------------------------------------------------

export type InvitationLandingInfo =
  | { kind: "ok"; organizationName: string; maskedPhone: string; status: AccountInvitationRow["status"] }
  | { kind: "invalid_invitation" };

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "••••" : `••••${phone.slice(-4)}`;
}

/** Minimal disclosure: organization display name, masked phone, and UX-relevant status only — never internal ids, notes or admission detail. */
export async function getInvitationLandingInfo(rawToken: string): Promise<InvitationLandingInfo> {
  const tokenHash = hashInvitationToken(rawToken);
  const [invitation] = await db.select().from(accountInvitation).where(eq(accountInvitation.tokenHash, tokenHash)).limit(1);
  if (!invitation) return { kind: "invalid_invitation" };

  const status: AccountInvitationRow["status"] = invitation.tokenExpiresAt.getTime() <= Date.now() && invitation.status !== "CONSUMED" && invitation.status !== "REVOKED"
    ? "EXPIRED"
    : invitation.status;
  const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, invitation.organizationId)).limit(1);
  return { kind: "ok", organizationName: org?.name ?? "ANEI", maskedPhone: maskPhone(invitation.destinationPhone), status };
}

// --- Shared helpers --------------------------------------------------------------------------

function classifyInvitationForPublicUse(
  invitation: AccountInvitationRow,
):
  | { kind: "invitation_expired" }
  | { kind: "invitation_revoked" }
  | { kind: "already_consumed" }
  | { kind: "not_eligible" }
  | null {
  if (invitation.status === "REVOKED") return { kind: "invitation_revoked" };
  if (invitation.status === "CONSUMED") return { kind: "already_consumed" };
  if (invitation.status === "EXPIRED" || invitation.tokenExpiresAt.getTime() <= Date.now()) return { kind: "invitation_expired" };
  if (invitation.status === "PENDING_SEND" || invitation.status === "SEND_FAILED") return { kind: "not_eligible" };
  return null;
}

class InvitationConflict extends Error {}
class NotFound extends Error {}
class InvalidTransition extends Error {}
class SendLimit extends Error {}
class SendCooldown extends Error {}

export type { AccountInvitationRow };
