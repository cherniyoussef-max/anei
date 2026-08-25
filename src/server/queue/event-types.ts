import { z } from "zod";

/**
 * Allowlisted outbox event types. Extending this list requires: a DB CHECK
 * update (drizzle/000N_*.sql), a payload schema below, and a handler in
 * src/server/queue/handlers/. Never store an arbitrary/executable handler
 * name in the database — the worker only ever dispatches through this fixed
 * registry (src/server/queue/worker-engine.ts).
 */
export const outboxEventTypes = ["WHATSAPP_TEMPLATE_SEND", "AUTOMATION_TRIGGER", "WHATSAPP_AI_REPLY"] as const;
export type OutboxEventType = (typeof outboxEventTypes)[number];

export function isOutboxEventType(value: string): value is OutboxEventType {
  return (outboxEventTypes as readonly string[]).includes(value);
}

/**
 * WHATSAPP_TEMPLATE_SEND payload: a bare reference to an already-created
 * whatsapp_message row (status QUEUED). The worker reloads every other fact
 * it needs (account, template, parameters) from the database — no PII, no
 * secrets, no large snapshot is duplicated into the outbox row. See
 * src/server/db/schema.ts's whatsappMessage.bodyParameters/
 * bodyParametersEncrypted for where the (possibly encrypted) template
 * parameters actually live.
 */
export const whatsappTemplateSendPayloadSchema = z.object({ messageId: z.string().uuid() }).strict();
export type WhatsAppTemplateSendPayload = z.infer<typeof whatsappTemplateSendPayloadSchema>;

export const automationTriggerPayloadSchema = z.object({ automationExecutionId: z.string() }).strict();
export type AutomationTriggerPayload = z.infer<typeof automationTriggerPayloadSchema>;

/**
 * WHATSAPP_AI_REPLY payload: a bare reference to the INBOUND whatsapp_message
 * row that triggered the reply. The worker reloads the contact, account,
 * and recent message history fresh — no message text/PII is duplicated into
 * the outbox row.
 */
export const whatsappAiReplyPayloadSchema = z.object({ inboundMessageId: z.string().uuid() }).strict();
export type WhatsAppAiReplyPayload = z.infer<typeof whatsappAiReplyPayloadSchema>;

type OutboxPayloadMap = {
  WHATSAPP_TEMPLATE_SEND: WhatsAppTemplateSendPayload;
  AUTOMATION_TRIGGER: AutomationTriggerPayload;
  WHATSAPP_AI_REPLY: WhatsAppAiReplyPayload;
};

/** Parses/validates a raw JSONB payload against its event type's versioned schema. Returns null on any mismatch (malformed/version-drifted payloads fail safe, never throw into the worker loop). */
export function parseOutboxPayload<T extends OutboxEventType>(eventType: T, raw: unknown): OutboxPayloadMap[T] | null {
  if (eventType === "WHATSAPP_TEMPLATE_SEND") {
    const parsed = whatsappTemplateSendPayloadSchema.safeParse(raw);
    return (parsed.success ? parsed.data : null) as OutboxPayloadMap[T] | null;
  }
  if (eventType === "WHATSAPP_AI_REPLY") {
    const parsed = whatsappAiReplyPayloadSchema.safeParse(raw);
    return (parsed.success ? parsed.data : null) as OutboxPayloadMap[T] | null;
  }
  const parsed = automationTriggerPayloadSchema.safeParse(raw);
  return (parsed.success ? parsed.data : null) as OutboxPayloadMap[T] | null;
}
