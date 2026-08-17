import { z } from "zod";

/**
 * Allowlisted outbox event types. Extending this list requires: a DB CHECK
 * update (drizzle/000N_*.sql), a payload schema below, and a handler in
 * src/server/queue/handlers/. Never store an arbitrary/executable handler
 * name in the database — the worker only ever dispatches through this fixed
 * registry (src/server/queue/worker-engine.ts).
 */
export const outboxEventTypes = ["WHATSAPP_TEMPLATE_SEND"] as const;
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

const payloadSchemas = {
  WHATSAPP_TEMPLATE_SEND: whatsappTemplateSendPayloadSchema,
} satisfies Record<OutboxEventType, z.ZodType>;

/** Parses/validates a raw JSONB payload against its event type's versioned schema. Returns null on any mismatch (malformed/version-drifted payloads fail safe, never throw into the worker loop). */
export function parseOutboxPayload<T extends OutboxEventType>(eventType: T, raw: unknown): z.infer<(typeof payloadSchemas)[T]> | null {
  const schema = payloadSchemas[eventType];
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
