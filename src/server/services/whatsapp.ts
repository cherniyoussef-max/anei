import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/server/db";
import {
  auditLogs,
  crmContact,
  crmContactActivity,
  whatsappAccount,
  whatsappMessage,
  whatsappTemplate,
  type WhatsappAccountRow,
} from "@/server/db/schema";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";
import {
  canManageWhatsappConfig,
  canManageWhatsappMessages,
} from "@/modules/whatsapp/domain/permissions";
import { WhatsAppNotConfiguredError, WhatsAppProviderError } from "@/server/whatsapp/contracts";
import { metaWhatsAppCloudProvider } from "@/server/whatsapp/meta";
import { normalizeWhatsAppPhone } from "@/server/whatsapp/phone";
import { getWhatsAppAccountForOrg } from "@/server/queries/whatsapp";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WhatsAppMutationResult =
  | { kind: "ok"; id: string }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict" }
  | { kind: "no_account" }
  | { kind: "no_phone" }
  | { kind: "invalid_template" }
  | { kind: "invalid_parameters" }
  | { kind: "not_configured" }
  | { kind: "provider_error"; code?: string | null; providerErrorCode?: string | null; providerErrorMessage?: string | null };

/**
 * Who is initiating a WhatsApp send. `null` means a system-initiated send
 * (e.g. the Phase 6 invitation/OTP flow) that has ALREADY been authorized and
 * rate-limited by its own boundary — the whatsapp service gate is skipped and
 * the message row records no human actor. A present actor is a human admin
 * and the standard organization-role gate applies.
 */
export type WhatsAppSendActor = { userId: string; role: OrganizationRole } | null;

const MAX_BODY_PARAMETERS = 32;
const MAX_PARAMETER_TEXT_LENGTH = 4_096;

function isActiveMetaAccount(account: WhatsappAccountRow | undefined): boolean {
  return Boolean(account && account.provider === "meta" && account.status === "ACTIVE");
}

/**
 * Creates or updates the organization's WhatsApp account metadata. Only
 * non-secret provider metadata is stored — the deployment-level Meta access
 * token lives in env. phoneNumberId is globally unique on Meta, so a conflict
 * (another organization already claiming the number) is surfaced explicitly.
 */
export async function upsertWhatsAppAccount(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  data: { phoneNumberId: string; businessAccountId: string; displayPhoneNumber?: string | null },
): Promise<WhatsAppMutationResult> {
  if (!canManageWhatsappConfig(actorRole)) return { kind: "forbidden" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(whatsappAccount)
      .where(eq(whatsappAccount.organizationId, organizationId))
      .limit(1);

    try {
      if (existing) {
        const [row] = await tx
          .update(whatsappAccount)
          .set({
            phoneNumberId: data.phoneNumberId,
            businessAccountId: data.businessAccountId,
            displayPhoneNumber: data.displayPhoneNumber ?? null,
            updatedAt: new Date(),
          })
          .where(eq(whatsappAccount.id, existing.id))
          .returning();
        await tx.insert(auditLogs).values({
          actorUserId,
          action: "whatsapp.account.update",
          entityType: "whatsapp_account",
          entityId: row.id,
          metadata: { organizationId, phoneNumberId: data.phoneNumberId, businessAccountId: data.businessAccountId },
        });
        return { kind: "ok", id: row.id };
      }

      const [row] = await tx
        .insert(whatsappAccount)
        .values({
          organizationId,
          provider: "meta",
          phoneNumberId: data.phoneNumberId,
          businessAccountId: data.businessAccountId,
          displayPhoneNumber: data.displayPhoneNumber ?? null,
          status: "ACTIVE",
        })
        .returning();
      await tx.insert(auditLogs).values({
        actorUserId,
        action: "whatsapp.account.create",
        entityType: "whatsapp_account",
        entityId: row.id,
        metadata: { organizationId, phoneNumberId: data.phoneNumberId, businessAccountId: data.businessAccountId },
      });
      return { kind: "ok", id: row.id };
    } catch {
      return { kind: "conflict" };
    }
  });
}

/**
 * Pulls the provider's message-template catalog for the organization's account
 * and upserts it into the local org-scoped `whatsapp_template` metadata table.
 * This mirrors provider metadata only — it is not a second template editor.
 * Sends still require an APPROVED local row for the organization.
 */
export async function syncWhatsAppTemplates(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
): Promise<WhatsAppMutationResult & { imported?: number }> {
  if (!canManageWhatsappConfig(actorRole)) return { kind: "forbidden" };

  const account = await getWhatsAppAccountForOrg(organizationId);
  if (!account || !isActiveMetaAccount(account)) return { kind: "no_account" };

  let providerTemplates;
  try {
    providerTemplates = await metaWhatsAppCloudProvider.listTemplates(account.businessAccountId);
  } catch (error) {
    if (error instanceof WhatsAppNotConfiguredError) return { kind: "not_configured" };
    if (error instanceof WhatsAppProviderError) {
      return { kind: "provider_error", code: error.code, providerErrorCode: error.providerErrorCode, providerErrorMessage: error.providerErrorMessage };
    }
    throw error;
  }

  const imported = await db.transaction(async (tx) => {
    let count = 0;
    for (const template of providerTemplates) {
      const status = template.status === "APPROVED" ? "APPROVED"
        : template.status === "REJECTED" ? "REJECTED"
        : template.status === "PAUSED" ? "PAUSED"
        : template.status === "DISABLED" ? "DISABLED"
        : "PENDING";
      await tx
        .insert(whatsappTemplate)
        .values({
          organizationId,
          name: template.name,
          language: template.language,
          category: template.category,
          status,
          parameterCount: template.parameterCount,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [whatsappTemplate.organizationId, whatsappTemplate.name, whatsappTemplate.language],
          set: {
            category: template.category,
            status,
            parameterCount: template.parameterCount,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      count += 1;
    }
    return count;
  });

  await db.insert(auditLogs).values({
    actorUserId,
    action: "whatsapp.templates.sync",
    entityType: "whatsapp",
    metadata: { organizationId, imported },
  });
  return { kind: "ok", id: organizationId, imported };
}

function validateBodyParameters(parameters: unknown[], parameterCount: number): string[] | null {
  if (!Array.isArray(parameters)) return null;
  if (parameters.length > MAX_BODY_PARAMETERS) return null;
  if (parameterCount === 0 && parameters.length > 0) return null;
  if (parameterCount > 0 && parameters.length > parameterCount) return null;

  const validated: string[] = [];
  for (const parameter of parameters) {
    if (typeof parameter !== "string") return null;
    const text = parameter.trim();
    if (text.length > MAX_PARAMETER_TEXT_LENGTH) return null;
    validated.push(text);
  }
  return validated;
}

/**
 * Sends an approved WhatsApp template to a CRM contact on behalf of the
 * organization's configured account.
 *
 * The server, not the browser, determines provider account, organization
 * scope, destination, template and language — the client may only supply a
 * contact id, template id, language and a bounded list of body parameter
 * strings. Raw Meta payload injection is impossible by construction.
 *
 * This is the human-admin path: it requires an actor and applies the
 * organization-role gate (`canManageWhatsappMessages`). The Phase 6
 * invitation/OTP flow uses the same underlying `sendWhatsAppTemplateCore`
 * with a system actor (`null`) and its own authorization/rate-limit boundary.
 *
 * External-side-effect consistency: the local message row (status QUEUED) is
 * persisted BEFORE the Meta call, keyed by a unique `localRequestId`, then the
 * provider result is written back in a second transaction (SENT with the
 * provider message id, or FAILED with sanitized error details). A retry that
 * reuses the same request id never re-sends an already-finalized message.
 * The unavoidable limitation of a direct synchronous external call (a success
 * followed by a failed local write-back leaves the row QUEUED without a
 * provider id) is documented in the Phase 5 report.
 */
export async function sendWhatsAppTemplate(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  data: {
    contactId: string;
    templateId: string;
    language: string;
    parameters?: string[];
    requestId?: string;
  },
): Promise<WhatsAppMutationResult> {
  return sendWhatsAppTemplateCore(organizationId, data, { userId: actorUserId, role: actorRole });
}

/**
 * Shared outbound-send pipeline used by the human-admin path
 * (`sendWhatsAppTemplate`) and by system-initiated sends such as the Phase 6
 * invitation/OTP flow. `destinationPhone` is a SERVER-RESOLVED snapshot
 * override (e.g. the invitation's normalized destination) — it is never
 * accepted from a client schema; when absent the destination is read from the
 * contact's current phone, preserving the Phase 5 behavior exactly.
 */
export async function sendWhatsAppTemplateCore(
  organizationId: string,
  data: {
    contactId: string;
    templateId: string;
    language: string;
    parameters?: string[];
    requestId?: string;
    destinationPhone?: string | null;
  },
  actor: WhatsAppSendActor,
): Promise<WhatsAppMutationResult> {
  if (actor && !canManageWhatsappMessages(actor.role)) return { kind: "forbidden" };

  const account = await getWhatsAppAccountForOrg(organizationId);
  if (!account || !isActiveMetaAccount(account)) return { kind: "no_account" };

  // --- Load + validate the org-scoped send inputs (inside one transaction) ----
  let messageId: string | null = null;
  let existingStatus: string | null = null;
  let contactPhone: string | null = null;
  let templateName: string | null = null;
  let templateLanguage: string | null = null;
  let validatedParameters: string[] | null = null;

  try {
    await db.transaction(async (tx) => {
      const [contact] = await tx
        .select({ id: crmContact.id, phone: crmContact.phone })
        .from(crmContact)
        .where(and(eq(crmContact.id, data.contactId), eq(crmContact.organizationId, organizationId)))
        .limit(1);
      if (!contact) throw new SendValidation("invalid_contact");

      const [template] = await tx
        .select()
        .from(whatsappTemplate)
        .where(
          and(
            eq(whatsappTemplate.id, data.templateId),
            eq(whatsappTemplate.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!template || template.status !== "APPROVED") throw new SendValidation("invalid_template");

      const normalized = normalizeWhatsAppPhone(data.destinationPhone ?? contact.phone);
      if (!normalized) throw new SendValidation("no_phone");

      const parameters = validateBodyParameters(data.parameters ?? [], template.parameterCount);
      if (!parameters) throw new SendValidation("invalid_parameters");

      const requestId = data.requestId?.trim() || crypto.randomUUID();
      const localRequestId = requestId.slice(0, 128);

      const [existing] = await tx
        .select({ id: whatsappMessage.id, status: whatsappMessage.status })
        .from(whatsappMessage)
        .where(and(eq(whatsappMessage.localRequestId, localRequestId), eq(whatsappMessage.organizationId, organizationId)))
        .limit(1);
      if (existing && existing.status !== "QUEUED") {
        existingStatus = existing.status;
        messageId = existing.id;
        return;
      }
      if (existing) {
        // A prior attempt was interrupted before the provider result was
        // written back — safe to re-attempt the send (no provider id stored).
        messageId = existing.id;
      } else {
        try {
          const [row] = await tx
            .insert(whatsappMessage)
            .values({
              organizationId,
              accountId: account.id,
              contactId: contact.id,
              direction: "OUTBOUND",
              messageType: "TEMPLATE",
              status: "QUEUED",
              localRequestId,
              toPhone: normalized,
              templateName: template.name,
              templateLanguage: data.language,
              createdByUserId: actor?.userId ?? null,
            })
            .returning();
          messageId = row.id;
        } catch {
          throw new SendDuplicate();
        }
      }

      contactPhone = normalized;
      templateName = template.name;
      templateLanguage = data.language;
      validatedParameters = parameters;
    });
  } catch (error) {
    if (error instanceof SendValidation) {
      const map = {
        invalid_contact: "not_found",
        invalid_template: "invalid_template",
        no_phone: "no_phone",
        invalid_parameters: "invalid_parameters",
      } as const;
      return { kind: map[error.reason] };
    }
    if (error instanceof SendDuplicate) return { kind: "conflict" };
    throw error;
  }

  if (!messageId) throw new Error("WHATSAPP_SEND_NO_MESSAGE");

  if (existingStatus) {
    // Idempotent retry of an already-finalized logical send — no re-send.
    return { kind: "ok", id: messageId };
  }

  // --- External provider call (never inside a DB transaction) ----------------
  let providerMessageId: string;
  try {
    const result = await metaWhatsAppCloudProvider.sendTemplateMessage({
      phoneNumberId: account.phoneNumberId,
      to: contactPhone!,
      templateName: templateName!,
      language: templateLanguage!,
      bodyParameters: (validatedParameters ?? []).map((text) => ({ type: "text", text })),
    });
    providerMessageId = result.providerMessageId;
  } catch (error) {
    if (error instanceof WhatsAppNotConfiguredError) return { kind: "not_configured" };
    let code: string | undefined;
    let providerErrorCode: string | null | undefined;
    let providerErrorMessage: string | null | undefined;
    if (error instanceof WhatsAppProviderError) {
      code = error.code;
      providerErrorCode = error.providerErrorCode;
      providerErrorMessage = error.providerErrorMessage;
    }
    await recordOutboundFailure(actor?.userId ?? null, organizationId, messageId, providerErrorCode, providerErrorMessage);
    return { kind: "provider_error", code, providerErrorCode, providerErrorMessage };
  }

  await recordOutboundSent(actor?.userId ?? null, organizationId, messageId, providerMessageId);
  return { kind: "ok", id: messageId };
}

async function recordOutboundSent(
  actorUserId: string | null,
  organizationId: string,
  messageId: string,
  providerMessageId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ contactId: whatsappMessage.contactId, status: whatsappMessage.status })
      .from(whatsappMessage)
      .where(eq(whatsappMessage.id, messageId))
      .limit(1);
    if (!row) return;
    if (row.status !== "QUEUED") return; // a racing status callback already moved it forward
    await tx
      .update(whatsappMessage)
      .set({ providerMessageId, status: "SENT", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappMessage.id, messageId));
    if (row.contactId) {
      await tx.insert(crmContactActivity).values({
        contactId: row.contactId,
        actorUserId,
        type: "WHATSAPP_TEMPLATE_SENT",
        metadata: { messageId, organizationId },
      });
    }
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "whatsapp.message.send",
      entityType: "whatsapp_message",
      entityId: messageId,
      metadata: { organizationId, contactId: row.contactId ?? null },
    });
  });
}

async function recordOutboundFailure(
  actorUserId: string | null,
  organizationId: string,
  messageId: string,
  providerErrorCode: string | null | undefined,
  providerErrorMessage: string | null | undefined,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ contactId: whatsappMessage.contactId, status: whatsappMessage.status })
      .from(whatsappMessage)
      .where(eq(whatsappMessage.id, messageId))
      .limit(1);
    if (!row) return;
    if (row.status !== "QUEUED") return;
    await tx
      .update(whatsappMessage)
      .set({
        status: "FAILED",
        failedAt: new Date(),
        providerErrorCode: providerErrorCode ? String(providerErrorCode).slice(0, 64) : null,
        providerErrorMessage: providerErrorMessage ? providerErrorMessage.slice(0, 500) : null,
        updatedAt: new Date(),
      })
      .where(eq(whatsappMessage.id, messageId));
    if (row.contactId) {
      await tx.insert(crmContactActivity).values({
        contactId: row.contactId,
        actorUserId,
        type: "WHATSAPP_FAILED",
        metadata: { messageId, organizationId, code: providerErrorCode ?? null },
      });
    }
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "whatsapp.message.send.failed",
      entityType: "whatsapp_message",
      entityId: messageId,
      metadata: { organizationId, contactId: row.contactId ?? null },
    });
  });
}

class SendValidation extends Error {
  constructor(readonly reason: "invalid_contact" | "invalid_template" | "no_phone" | "invalid_parameters") {
    super(reason);
  }
}

class SendDuplicate extends Error {
  constructor() {
    super("SEND_DUPLICATE");
  }
}

export type { DbClient };