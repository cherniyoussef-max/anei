import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  crmContact,
  crmContactActivity,
  whatsappAccount,
  whatsappMessage,
  whatsappWebhookEvent,
} from "@/server/db/schema";
import type { NormalizedInboundMessage, NormalizedStatusUpdate, NormalizedWebhookEvent } from "@/server/whatsapp/normalize";
import { webhookStableKey } from "@/server/whatsapp/webhook";
import { normalizeWhatsAppPhone, phonesMatch } from "@/server/whatsapp/phone";
import { canApplyMessageStatus, type WhatsAppMessageStatus } from "@/modules/whatsapp/domain/permissions";
import { enqueueOutboxEvent } from "@/server/queue/outbox";
import { whatsappAiRepliesConfigured } from "@/server/env";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WebhookProcessingSummary = {
  processed: number;
  duplicates: number;
  unknownAccount: number;
  unknownMessage: number;
};

/**
 * Deterministically resolves an inbound wa_id to a CRM contact within an
 * organization. Matching requires EXACTLY one contact whose phone normalizes
 * to the sender's digits; zero matches (no contact yet) or multiple matches
 * (ambiguous) both resolve to `undefined` → the message is stored with a null
 * contactId. Never auto-creates a contact/user — WhatsApp is a channel, not
 * an identity system.
 */
async function resolveContactForWaId(tx: DbClient, organizationId: string, waId: string): Promise<string | null> {
  const normalized = normalizeWhatsAppPhone(waId);
  if (!normalized) return null;

  const rows = await tx
    .select({ id: crmContact.id, phone: crmContact.phone })
    .from(crmContact)
    .where(and(eq(crmContact.organizationId, organizationId), eq(crmContact.status, "ACTIVE")));

  const matches = rows.filter((row) => phonesMatch(row.phone, normalized));
  return matches.length === 1 ? matches[0]!.id : null;
}

/** Inserts the idempotency ledger row; returns null when the event is a replay. */
async function claimWebhookEvent(
  tx: DbClient,
  stableKey: string,
  eventType: "INBOUND_MESSAGE" | "STATUS_UPDATE",
  organizationId: string | null,
): Promise<boolean> {
  const [row] = await tx
    .insert(whatsappWebhookEvent)
    .values({ stableKey, eventType, organizationId })
    .onConflictDoNothing()
    .returning({ id: whatsappWebhookEvent.id });
  return Boolean(row);
}

async function processInbound(tx: DbClient, event: NormalizedInboundMessage): Promise<"processed" | "duplicate" | "unknown_account"> {
  const account = await tx
    .select()
    .from(whatsappAccount)
    .where(eq(whatsappAccount.phoneNumberId, event.phoneNumberId))
    .limit(1);

  const accountRow = account[0];
  if (!accountRow) return "unknown_account";

  const stableKey = webhookStableKey("message", event.messageId);
  const claimed = await claimWebhookEvent(tx, stableKey, "INBOUND_MESSAGE", accountRow.organizationId);
  if (!claimed) return "duplicate";

  const contactId = await resolveContactForWaId(tx, accountRow.organizationId, event.senderWaId);

  const [inserted] = await tx
    .insert(whatsappMessage)
    .values({
      organizationId: accountRow.organizationId,
      accountId: accountRow.id,
      contactId,
      direction: "INBOUND",
      messageType: event.messageType,
      status: "DELIVERED", // Meta delivered it to us; inbound delivery state is authoritative
      providerMessageId: event.messageId,
      fromPhone: event.senderWaId,
      textPreview: event.textPreview,
      deliveredAt: event.timestamp ? new Date(event.timestamp * 1000) : new Date(),
    })
    .returning({ id: whatsappMessage.id });

  if (contactId) {
    await tx.insert(crmContactActivity).values({
      contactId,
      actorUserId: null,
      type: "WHATSAPP_MESSAGE_RECEIVED",
      metadata: { messageId: event.messageId, direction: "INBOUND" },
    });

    // Dev/staging only (whatsappAiRepliesConfigured is always false in
    // production, see src/server/env.ts). A text message with no resolvable
    // reply content (e.g. an image/location-only inbound) still gets a
    // best-effort reply attempt — the handler falls back to a safe generic
    // response rather than skipping silently.
    if (event.messageType === "TEXT" && whatsappAiRepliesConfigured) {
      await enqueueOutboxEvent(tx, {
        organizationId: accountRow.organizationId,
        aggregateType: "whatsapp_message",
        aggregateId: inserted.id,
        eventType: "WHATSAPP_AI_REPLY",
        payload: { inboundMessageId: inserted.id },
        idempotencyKey: `whatsapp-ai-reply:${inserted.id}`,
      });
    }
  }

  return "processed";
}

async function processStatus(tx: DbClient, event: NormalizedStatusUpdate): Promise<"processed" | "duplicate" | "unknown_message"> {
  const stableKey = webhookStableKey("status", event.messageId, event.status);
  const claimed = await claimWebhookEvent(tx, stableKey, "STATUS_UPDATE", null);
  if (!claimed) return "duplicate";

  const message = await tx
    .select()
    .from(whatsappMessage)
    .where(eq(whatsappMessage.providerMessageId, event.messageId))
    .limit(1);

  const row = message[0];
  if (!row) return "unknown_message";

  const currentStatus = row.status as WhatsAppMessageStatus;
  if (!canApplyMessageStatus(currentStatus, event.status)) {
    // Out-of-order/replayed callback — ignore (idempotency row already claimed).
    await tx
      .update(whatsappWebhookEvent)
      .set({ processedAt: new Date() })
      .where(eq(whatsappWebhookEvent.stableKey, stableKey));
    return "processed";
  }

  const timestamp = event.timestamp ? new Date(event.timestamp * 1000) : new Date();
  const set: Partial<typeof whatsappMessage.$inferInsert> = { status: event.status, updatedAt: new Date() };
  if (event.status === "SENT") set.sentAt = timestamp;
  if (event.status === "DELIVERED") set.deliveredAt = timestamp;
  if (event.status === "READ") set.readAt = timestamp;
  if (event.status === "FAILED") {
    set.failedAt = timestamp;
    set.providerErrorCode = event.providerErrorCode;
    set.providerErrorMessage = event.providerErrorMessage;
  }

  await tx.update(whatsappMessage).set(set).where(eq(whatsappMessage.id, row.id));

  if (event.status === "FAILED" && row.contactId) {
    await tx.insert(crmContactActivity).values({
      contactId: row.contactId,
      actorUserId: null,
      type: "WHATSAPP_FAILED",
      metadata: { messageId: event.messageId, code: event.providerErrorCode },
    });
  }

  await tx
    .update(whatsappWebhookEvent)
    .set({ processedAt: new Date() })
    .where(eq(whatsappWebhookEvent.stableKey, stableKey));

  return "processed";
}

/**
 * Ingests a batch of normalized webhook events. Each event's dedup ledger row
 * is created in the same transaction as its side effects, so a Meta replay can
 * never double-insert a message, double-fire a CRM activity, or regress a
 * status. Unknown events (no matching account/number) are counted, not failed —
 * Meta may deliver events for numbers configured in another deployment.
 */
export async function ingestWebhookEvents(events: NormalizedWebhookEvent[]): Promise<WebhookProcessingSummary> {
  const summary: WebhookProcessingSummary = { processed: 0, duplicates: 0, unknownAccount: 0, unknownMessage: 0 };

  for (const event of events) {
    const outcome = await db.transaction(async (tx) => {
      if (event.kind === "inbound_message") return processInbound(tx, event);
      return processStatus(tx, event);
    });

    if (outcome === "processed") summary.processed += 1;
    if (outcome === "duplicate") summary.duplicates += 1;
    if (outcome === "unknown_account") summary.unknownAccount += 1;
    if (outcome === "unknown_message") summary.unknownMessage += 1;
  }

  return summary;
}