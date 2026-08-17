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
import { enqueueOutboxEvent } from "@/server/queue/outbox";
import { encryptSecretParameters } from "@/server/security/outbox-crypto";

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
 * Phase 9 delivery model: the local message row (status QUEUED) and its
 * outbox dispatch intent (`WHATSAPP_TEMPLATE_SEND`, keyed by the message id)
 * are persisted together in ONE transaction, keyed by a unique
 * `localRequestId` so a caller retry never creates a second logical job. The
 * actual Meta API call happens later, in the worker
 * (src/server/queue/handlers/whatsapp-template-send.ts) — this function
 * returns as soon as delivery is durably QUEUED, never after the provider
 * call. This is an at-least-once WORKER execution guarantee, not an
 * exactly-once PROVIDER delivery guarantee: see
 * docs/premium/PHASE9_HANDOFF.md for the residual ambiguous-outcome window
 * (provider accepts the send, the worker crashes before recording success).
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
  if (!canManageWhatsappMessages(actorRole)) return { kind: "forbidden" };
  return sendApprovedTemplateMessage(actorUserId, organizationId, data);
}

async function sendApprovedTemplateMessage(
  actorUserId: string | null,
  organizationId: string,
  data: {
    contactId: string;
    templateId: string;
    language: string;
    parameters?: string[];
    requestId?: string;
  },
): Promise<WhatsAppMutationResult> {
  return enqueueTemplateMessage(actorUserId, organizationId, {
    contactId: data.contactId,
    templateId: data.templateId,
    language: data.language,
    requestId: data.requestId,
    resolveParameters: (parameterCount) => validateBodyParameters(data.parameters ?? [], parameterCount),
    bodyParameters: (parameters) => ({ bodyParameters: parameters, bodyParametersEncrypted: null }),
  });
}

/**
 * System-initiated variant carrying SECRET template parameters (the OTP digit
 * string; the invitation URL which embeds the raw invitation token). The whole
 * parameter array is AES-256-GCM encrypted
 * (src/server/security/outbox-crypto.ts) before it is ever written to the
 * database — the raw values are held only in the caller's local variables and
 * are never persisted, logged, or placed in the outbox payload, preserving
 * Phase 6's "raw OTP/token is never stored" invariant across the async
 * boundary. The template must declare exactly `parameters.length` body
 * parameters. Pass `withinTx` to enqueue within the caller's own business
 * transaction (the mutation + this outbox insert then commit or roll back
 * together — see docs/premium/PHASE9_HANDOFF.md).
 */
export async function enqueueSystemWhatsAppTemplateWithSecretParameters(
  organizationId: string,
  data: { contactId: string; templateId: string; language: string; parameters: string[]; requestId: string },
  withinTx?: DbClient,
): Promise<WhatsAppMutationResult> {
  return enqueueTemplateMessage(
    null,
    organizationId,
    {
      contactId: data.contactId,
      templateId: data.templateId,
      language: data.language,
      requestId: data.requestId,
      resolveParameters: (parameterCount) => (parameterCount === data.parameters.length ? data.parameters : null),
      bodyParameters: (parameters) => ({ bodyParameters: null, bodyParametersEncrypted: encryptSecretParameters(parameters) }),
    },
    withinTx,
  );
}

/**
 * Shared transactional-enqueue core for every WhatsApp template send
 * (admin-triggered, system invitation-link, system OTP). Creates/reuses the
 * QUEUED `whatsapp_message` row and its `WHATSAPP_TEMPLATE_SEND` outbox
 * dispatch intent in ONE transaction, then returns — the Meta API call is
 * never made here (see src/server/queue/handlers/whatsapp-template-send.ts).
 * When `withinTx` is provided, the whole body runs inside the caller's
 * transaction (no nested transaction is opened); otherwise a fresh transaction
 * is used. `bodyParameters` decides how the validated parameters are persisted
 * (plaintext column vs. AES-256-GCM ciphertext column); callers never see each
 * other's storage choice.
 */
async function enqueueTemplateMessage(
  actorUserId: string | null,
  organizationId: string,
  data: {
    contactId: string;
    templateId: string;
    language: string;
    requestId?: string;
    resolveParameters: (parameterCount: number) => string[] | null;
    bodyParameters: (parameters: string[]) => { bodyParameters: string[] | null; bodyParametersEncrypted: { ciphertext: string; nonce: string } | null };
  },
  withinTx?: DbClient,
): Promise<WhatsAppMutationResult> {
  const account = withinTx
    ? (await withinTx.select().from(whatsappAccount).where(eq(whatsappAccount.organizationId, organizationId)).limit(1))[0]
    : await getWhatsAppAccountForOrg(organizationId);
  if (!account || !isActiveMetaAccount(account)) return { kind: "no_account" };

  let messageId: string | null = null;

  const body = async (tx: DbClient) => {
    const [contact] = await tx
      .select({ id: crmContact.id, phone: crmContact.phone })
      .from(crmContact)
      .where(and(eq(crmContact.id, data.contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact) throw new SendValidation("invalid_contact");

    const [template] = await tx
      .select()
      .from(whatsappTemplate)
      .where(and(eq(whatsappTemplate.id, data.templateId), eq(whatsappTemplate.organizationId, organizationId)))
      .limit(1);
    if (!template || template.status !== "APPROVED") throw new SendValidation("invalid_template");

    const normalized = normalizeWhatsAppPhone(contact.phone);
    if (!normalized) throw new SendValidation("no_phone");

    const parameters = data.resolveParameters(template.parameterCount);
    if (!parameters) throw new SendValidation("invalid_parameters");

    const requestId = data.requestId?.trim() || crypto.randomUUID();
    const localRequestId = requestId.slice(0, 128);

    const [existing] = await tx
      .select({ id: whatsappMessage.id, status: whatsappMessage.status })
      .from(whatsappMessage)
      .where(and(eq(whatsappMessage.localRequestId, localRequestId), eq(whatsappMessage.organizationId, organizationId)))
      .limit(1);
    if (existing && existing.status !== "QUEUED") {
      messageId = existing.id;
      return;
    }

    const storedParameters = data.bodyParameters(parameters);

    if (existing) {
      // A prior attempt was interrupted before an outbox event was durably
      // enqueued — safe to re-attempt (still QUEUED, no dispatch recorded).
      messageId = existing.id;
      await tx
        .update(whatsappMessage)
        .set({ bodyParameters: storedParameters.bodyParameters, bodyParametersEncrypted: storedParameters.bodyParametersEncrypted, updatedAt: new Date() })
        .where(eq(whatsappMessage.id, existing.id));
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
            bodyParameters: storedParameters.bodyParameters,
            bodyParametersEncrypted: storedParameters.bodyParametersEncrypted,
            createdByUserId: actorUserId,
          })
          .returning();
        messageId = row.id;
      } catch {
        throw new SendDuplicate();
      }
    }

    await enqueueOutboxEvent(tx, {
      organizationId,
      aggregateType: "whatsappMessage",
      aggregateId: messageId!,
      eventType: "WHATSAPP_TEMPLATE_SEND",
      payload: { messageId },
      // One durable dispatch job per message, regardless of how many times
      // the caller retries the enqueue call with the same requestId.
      idempotencyKey: `whatsapp-message:${messageId}`,
    });
  };

  try {
    if (withinTx) {
      await body(withinTx);
    } else {
      await db.transaction(body);
    }
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
  // Either a fresh QUEUED message + outbox dispatch just committed, or a
  // prior attempt already reached a terminal state — both are "ok" from the
  // caller's perspective (idempotent retry never re-enqueues).
  return { kind: "ok", id: messageId };
}

/** Exported for src/server/queue/handlers/whatsapp-template-send.ts — the worker's success write-back. Only advances a still-QUEUED row (a racing status callback that already moved it forward wins). */
export async function recordOutboundSent(
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
      .set({
        providerMessageId,
        status: "SENT",
        sentAt: new Date(),
        // Ciphertext/parameters are no longer needed once delivery has been
        // attempted — scrub them rather than retain secret/PII material.
        bodyParameters: null,
        bodyParametersEncrypted: null,
        updatedAt: new Date(),
      })
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

/** Exported for src/server/queue/handlers/whatsapp-template-send.ts — the worker's terminal-failure write-back. */
export async function recordOutboundFailure(
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
        bodyParameters: null,
        bodyParametersEncrypted: null,
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