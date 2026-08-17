import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { whatsappAccount, whatsappMessage, type OutboxEventRow } from "@/server/db/schema";
import type { HandlerOutcome, OutboxHandler, SanitizedError } from "@/server/queue/handler-types";
import { parseOutboxPayload, type WhatsAppTemplateSendPayload } from "@/server/queue/event-types";
import { WhatsAppNotConfiguredError, WhatsAppProviderError } from "@/server/whatsapp/contracts";
import { metaWhatsAppCloudProvider } from "@/server/whatsapp/meta";
import { decryptSecretParameters } from "@/server/security/outbox-crypto";
import { recordOutboundFailure, recordOutboundSent } from "@/server/services/whatsapp";

/**
 * Meta error codes known to be transient (rate limiting) and therefore safe
 * to retry. Everything else classified as "provider_rejected" (e.g. invalid
 * template/parameter count, template not approved anymore) is treated as
 * NON_RETRYABLE — retrying a rejected send cannot succeed and would just
 * burn attempts. This list is intentionally small and explicit rather than
 * inferred, per CLAUDE.md's "do not invent provider features."
 */
const RETRYABLE_META_ERROR_CODES = new Set(["4", "80007", "130429", "131048", "131056", "131057"]);

function classifyError(error: unknown): { retryable: boolean; sanitized: SanitizedError } {
  if (error instanceof WhatsAppNotConfiguredError) {
    return { retryable: false, sanitized: { code: "NOT_CONFIGURED", message: "WhatsApp provider is not configured" } };
  }
  if (error instanceof WhatsAppProviderError) {
    if (error.code === "auth_failed") {
      return { retryable: false, sanitized: { code: "AUTH_FAILED", message: "Provider credential rejected" } };
    }
    if (error.code === "unexpected" || error.code === "invalid_response") {
      // Provider 5xx / unparseable response — outcome is ambiguous (the send
      // may or may not have gone through), but treated as transient and
      // retried with backoff; see docs/premium/PHASE9_HANDOFF.md.
      return { retryable: true, sanitized: { code: error.code.toUpperCase(), message: "Provider transport error" } };
    }
    if (error.code === "provider_rejected") {
      const retryable = Boolean(error.providerErrorCode && RETRYABLE_META_ERROR_CODES.has(String(error.providerErrorCode)));
      return {
        retryable,
        sanitized: {
          code: retryable ? "RATE_LIMITED" : "REJECTED",
          message: (error.providerErrorMessage ?? "Provider rejected the send").slice(0, 300),
          providerErrorCode: error.providerErrorCode ?? null,
        },
      };
    }
    return { retryable: true, sanitized: { code: "PROVIDER_ERROR", message: "Unclassified provider error" } };
  }
  // Network failure/timeout: a genuinely ambiguous outcome (the request may
  // have reached Meta before the connection dropped). Retried with backoff —
  // Meta's template-send API offers no client dedupe token, so this window
  // carries a real (documented, not hidden) residual duplicate-send risk.
  return { retryable: true, sanitized: { code: "NETWORK_ERROR", message: "Network or timeout error calling the provider" } };
}

export const whatsappTemplateSendHandler: OutboxHandler<WhatsAppTemplateSendPayload> = {
  eventType: "WHATSAPP_TEMPLATE_SEND",

  parsePayload(raw) {
    return parseOutboxPayload("WHATSAPP_TEMPLATE_SEND", raw);
  },

  async handle(event: OutboxEventRow, payload: WhatsAppTemplateSendPayload): Promise<HandlerOutcome> {
    // Reload every fact fresh — never trust the payload's organizationId
    // beyond using it to scope this lookup (tenant isolation: a payload
    // referencing another organization's message simply won't be found).
    const [message] = await db
      .select()
      .from(whatsappMessage)
      .where(and(eq(whatsappMessage.id, payload.messageId), eq(whatsappMessage.organizationId, event.organizationId ?? "")))
      .limit(1);
    if (!message) {
      return { outcome: "NON_RETRYABLE", error: { code: "MESSAGE_NOT_FOUND", message: "Referenced whatsapp_message row not found for this organization" } };
    }
    if (message.status !== "QUEUED") {
      // Already finalized by a prior attempt (or otherwise advanced) —
      // idempotent no-op success, never re-sent.
      return { outcome: "SUCCEEDED" };
    }
    if (!message.accountId) {
      return { outcome: "NON_RETRYABLE", error: { code: "NO_ACCOUNT", message: "Message has no associated WhatsApp account" } };
    }

    const [account] = await db
      .select()
      .from(whatsappAccount)
      .where(and(eq(whatsappAccount.id, message.accountId), eq(whatsappAccount.organizationId, event.organizationId ?? "")))
      .limit(1);
    if (!account || account.provider !== "meta" || account.status !== "ACTIVE") {
      return { outcome: "NON_RETRYABLE", error: { code: "NO_ACCOUNT", message: "WhatsApp account is missing or inactive" } };
    }
    if (!message.toPhone || !message.templateName || !message.templateLanguage) {
      return { outcome: "NON_RETRYABLE", error: { code: "MALFORMED_MESSAGE", message: "Message is missing required send fields" } };
    }

    let parameters: string[];
    try {
      parameters = message.bodyParametersEncrypted
        ? decryptSecretParameters(message.bodyParametersEncrypted)
        : (message.bodyParameters ?? []);
    } catch {
      return { outcome: "NON_RETRYABLE", error: { code: "DECRYPTION_FAILED", message: "Could not decrypt the message's secret parameters" } };
    }

    try {
      const result = await metaWhatsAppCloudProvider.sendTemplateMessage({
        phoneNumberId: account.phoneNumberId,
        to: message.toPhone,
        templateName: message.templateName,
        language: message.templateLanguage,
        bodyParameters: parameters.map((text) => ({ type: "text", text })),
      });
      await recordOutboundSent(null, event.organizationId ?? account.organizationId, message.id, result.providerMessageId);
      return { outcome: "SUCCEEDED" };
    } catch (error) {
      const { retryable, sanitized } = classifyError(error);
      return retryable ? { outcome: "RETRYABLE", error: sanitized } : { outcome: "NON_RETRYABLE", error: sanitized };
    }
  },

  async onTerminalFailure(event: OutboxEventRow, payload: WhatsAppTemplateSendPayload, error: SanitizedError): Promise<void> {
    const [message] = await db
      .select({ id: whatsappMessage.id, status: whatsappMessage.status, organizationId: whatsappMessage.organizationId })
      .from(whatsappMessage)
      .where(and(eq(whatsappMessage.id, payload.messageId), eq(whatsappMessage.organizationId, event.organizationId ?? "")))
      .limit(1);
    if (!message || message.status !== "QUEUED") return;
    await recordOutboundFailure(null, message.organizationId, message.id, error.providerErrorCode ?? error.code, error.message);
  },
};
