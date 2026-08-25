import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/server/db";
import { crmContact, crmContactActivity, whatsappAccount, whatsappMessage, type OutboxEventRow } from "@/server/db/schema";
import type { HandlerOutcome, OutboxHandler, SanitizedError } from "@/server/queue/handler-types";
import { parseOutboxPayload, type WhatsAppAiReplyPayload } from "@/server/queue/event-types";
import { WhatsAppNotConfiguredError, WhatsAppProviderError } from "@/server/whatsapp/contracts";
import { metaWhatsAppCloudProvider } from "@/server/whatsapp/meta";
import { normalizeWhatsAppPhone } from "@/server/whatsapp/phone";
import { generateWhatsAppReply, type WhatsAppHistoryMessage } from "@/server/whatsapp/ai-reply";
import { env } from "@/server/env";
import { logger } from "@/server/security/logger";

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;

function classifySendError(error: unknown): { retryable: boolean; sanitized: SanitizedError } {
  if (error instanceof WhatsAppNotConfiguredError) {
    return { retryable: false, sanitized: { code: "NOT_CONFIGURED", message: "WhatsApp provider is not configured" } };
  }
  if (error instanceof WhatsAppProviderError) {
    if (error.code === "auth_failed") {
      return { retryable: false, sanitized: { code: "AUTH_FAILED", message: "Provider credential rejected" } };
    }
    if (error.code === "unexpected" || error.code === "invalid_response") {
      return { retryable: true, sanitized: { code: error.code.toUpperCase(), message: "Provider transport error" } };
    }
    if (error.code === "provider_rejected") {
      return {
        retryable: false,
        sanitized: {
          code: "REJECTED",
          message: (error.providerErrorMessage ?? "Provider rejected the send").slice(0, 300),
          providerErrorCode: error.providerErrorCode ?? null,
        },
      };
    }
    return { retryable: true, sanitized: { code: "PROVIDER_ERROR", message: "Unclassified provider error" } };
  }
  return { retryable: true, sanitized: { code: "NETWORK_ERROR", message: "Network or timeout error calling the provider or LLM" } };
}

export const whatsappAiReplyHandler: OutboxHandler<WhatsAppAiReplyPayload> = {
  eventType: "WHATSAPP_AI_REPLY",

  parsePayload(raw) {
    return parseOutboxPayload("WHATSAPP_AI_REPLY", raw);
  },

  async handle(event: OutboxEventRow, payload: WhatsAppAiReplyPayload): Promise<HandlerOutcome> {
    const organizationId = event.organizationId ?? "";
    const localRequestId = `ai-reply:${payload.inboundMessageId}`;

    const [existingReply] = await db
      .select({ id: whatsappMessage.id, status: whatsappMessage.status })
      .from(whatsappMessage)
      .where(and(eq(whatsappMessage.organizationId, organizationId), eq(whatsappMessage.localRequestId, localRequestId)))
      .limit(1);
    if (existingReply && existingReply.status !== "QUEUED") {
      return { outcome: "SUCCEEDED" };
    }

    const [inbound] = await db
      .select()
      .from(whatsappMessage)
      .where(and(eq(whatsappMessage.id, payload.inboundMessageId), eq(whatsappMessage.organizationId, organizationId)))
      .limit(1);
    if (!inbound || inbound.direction !== "INBOUND" || !inbound.contactId || !inbound.fromPhone) {
      return { outcome: "NON_RETRYABLE", error: { code: "INVALID_SOURCE_MESSAGE", message: "Referenced inbound message not found, unresolved, or malformed" } };
    }

    const sessionAge = Date.now() - (inbound.deliveredAt ?? inbound.createdAt).getTime();
    if (sessionAge > SESSION_WINDOW_MS) {
      return { outcome: "NON_RETRYABLE", error: { code: "SESSION_WINDOW_CLOSED", message: "Meta's 24h customer-service window has closed" } };
    }

    const [contact] = await db
      .select({ id: crmContact.id, status: crmContact.status })
      .from(crmContact)
      .where(and(eq(crmContact.id, inbound.contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact || contact.status !== "ACTIVE") {
      return { outcome: "NON_RETRYABLE", error: { code: "CONTACT_INACTIVE", message: "Contact not found or archived" } };
    }

    const [account] = await db
      .select()
      .from(whatsappAccount)
      .where(eq(whatsappAccount.organizationId, organizationId))
      .limit(1);
    if (!account || account.provider !== "meta" || account.status !== "ACTIVE") {
      return { outcome: "NON_RETRYABLE", error: { code: "NO_ACCOUNT", message: "WhatsApp account is missing or inactive" } };
    }

    const since = new Date(Date.now() - SESSION_WINDOW_MS);
    const recentReplies = await db
      .select({ id: whatsappMessage.id })
      .from(whatsappMessage)
      .where(
        and(
          eq(whatsappMessage.contactId, contact.id),
          eq(whatsappMessage.direction, "OUTBOUND"),
          eq(whatsappMessage.messageType, "TEXT"),
          gte(whatsappMessage.createdAt, since),
        ),
      );
    if (recentReplies.length >= env.WHATSAPP_AI_REPLY_MAX_PER_CONTACT_PER_DAY) {
      logger.warn("whatsapp.ai_reply.rate_capped", { organizationId, contactId: contact.id });
      return { outcome: "NON_RETRYABLE", error: { code: "RATE_CAPPED", message: "Per-contact daily AI reply cap reached" } };
    }

    const historyRows = await db
      .select({ direction: whatsappMessage.direction, textPreview: whatsappMessage.textPreview })
      .from(whatsappMessage)
      .where(eq(whatsappMessage.contactId, contact.id))
      .orderBy(desc(whatsappMessage.createdAt))
      .limit(HISTORY_LIMIT);
    const history: WhatsAppHistoryMessage[] = historyRows.reverse().map((row) => ({ direction: row.direction as "INBOUND" | "OUTBOUND", text: row.textPreview }));

    const normalized = normalizeWhatsAppPhone(inbound.fromPhone);
    if (!normalized) {
      return { outcome: "NON_RETRYABLE", error: { code: "NO_PHONE", message: "Inbound sender phone did not normalize" } };
    }

    let reply: Awaited<ReturnType<typeof generateWhatsAppReply>>;
    try {
      reply = await generateWhatsAppReply({ history, latestInboundText: inbound.textPreview ?? "" });
    } catch (error) {
      logger.warn("whatsapp.ai_reply.generation_failed", { organizationId, contactId: contact.id, error: error instanceof Error ? error.message : "unknown" });
      return { outcome: "RETRYABLE", error: { code: "LLM_ERROR", message: "AI reply generation failed" } };
    }

    let messageId = existingReply?.id;
    if (!messageId) {
      try {
        const [created] = await db
          .insert(whatsappMessage)
          .values({
            organizationId,
            accountId: account.id,
            contactId: contact.id,
            direction: "OUTBOUND",
            messageType: "TEXT",
            status: "QUEUED",
            localRequestId,
            toPhone: normalized,
            textPreview: reply.text,
          })
          .returning({ id: whatsappMessage.id });
        messageId = created.id;
      } catch {
        return { outcome: "SUCCEEDED" }; // Idempotency-key race: another worker attempt already created/sent it.
      }
    }

    try {
      const result = await metaWhatsAppCloudProvider.sendTextMessage({ phoneNumberId: account.phoneNumberId, to: normalized, body: reply.text });
      await db.transaction(async (tx) => {
        await tx
          .update(whatsappMessage)
          .set({ providerMessageId: result.providerMessageId, status: "SENT", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappMessage.id, messageId!));
        await tx.insert(crmContactActivity).values({
          contactId: contact.id,
          actorUserId: null,
          type: "WHATSAPP_AI_REPLY_SENT",
          metadata: { messageId, inboundMessageId: payload.inboundMessageId, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens },
        });
      });
      return { outcome: "SUCCEEDED" };
    } catch (error) {
      const { retryable, sanitized } = classifySendError(error);
      return retryable ? { outcome: "RETRYABLE", error: sanitized } : { outcome: "NON_RETRYABLE", error: sanitized };
    }
  },

  async onTerminalFailure(event: OutboxEventRow, payload: WhatsAppAiReplyPayload, error: SanitizedError): Promise<void> {
    const organizationId = event.organizationId ?? "";
    const localRequestId = `ai-reply:${payload.inboundMessageId}`;
    const [message] = await db
      .select({ id: whatsappMessage.id, status: whatsappMessage.status, contactId: whatsappMessage.contactId })
      .from(whatsappMessage)
      .where(and(eq(whatsappMessage.organizationId, organizationId), eq(whatsappMessage.localRequestId, localRequestId)))
      .limit(1);
    if (!message || message.status !== "QUEUED") return;
    await db.transaction(async (tx) => {
      await tx
        .update(whatsappMessage)
        .set({ status: "FAILED", failedAt: new Date(), providerErrorCode: error.code.slice(0, 64), providerErrorMessage: error.message.slice(0, 500), updatedAt: new Date() })
        .where(eq(whatsappMessage.id, message.id));
      if (message.contactId) {
        await tx.insert(crmContactActivity).values({
          contactId: message.contactId,
          actorUserId: null,
          type: "WHATSAPP_FAILED",
          metadata: { messageId: message.id, code: error.code },
        });
      }
    });
  },
};
