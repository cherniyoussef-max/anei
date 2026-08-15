// Provider webhook normalization boundary. Converts a bounded, validated Meta
// WhatsApp Cloud API POST payload into plain domain events. This module is
// pure (no DB, no fetch) so it is trivially unit-testable; all field lengths
// are bounded and nested provider structures are never passed through to the
// domain model as-is.

import { z } from "zod";

// The envelope is deliberately loose (.passthrough) — Meta's exact field set
// evolves — but every field we actually consume is strictly bounded.
const idField = z.string().trim().min(1).max(256);
const phoneField = z.string().trim().min(1).max(32);
const timestampField = z.string().trim().min(1).max(20);
// Deliberately wide at the schema layer: over-long bodies are TRUNCATED to a
// bounded preview in normalization, never used to reject the whole message.
const textBodyField = z.string().trim().max(50_000);

const metadataSchema = z
  .object({
    display_phone_number: z.string().trim().max(32).optional(),
    phone_number_id: idField.optional(),
  })
  .passthrough();

const messageSchema = z
  .object({
    from: phoneField.optional(),
    id: idField.optional(),
    timestamp: timestampField.optional(),
    type: z.string().trim().max(32).optional(),
    text: z.object({ body: textBodyField.optional() }).partial().optional(),
  })
  .passthrough();

const errorSchema = z
  .object({
    code: z.union([z.number().int(), z.string().trim().max(16)]).optional(),
    message: z.string().trim().max(1_000).optional(),
  })
  .passthrough();

const statusSchema = z
  .object({
    id: idField.optional(),
    status: z.enum(["sent", "delivered", "read", "failed"]).optional(),
    timestamp: timestampField.optional(),
    errors: z.array(errorSchema).max(10).optional(),
  })
  .passthrough();

const valueSchema = z
  .object({
    metadata: metadataSchema.optional(),
    messages: z.array(messageSchema).max(100).optional(),
    statuses: z.array(statusSchema).max(100).optional(),
  })
  .passthrough();

const changeSchema = z
  .object({
    field: z.string().trim().max(64).optional(),
    value: valueSchema.optional(),
  })
  .passthrough();

const entrySchema = z
  .object({
    id: idField.optional(),
    changes: z.array(changeSchema).max(20).optional(),
  })
  .passthrough();

const payloadSchema = z
  .object({
    object: z.string().trim().max(64).optional(),
    entry: z.array(entrySchema).max(20).optional(),
  })
  .passthrough();

export type NormalizedInboundMessage = {
  kind: "inbound_message";
  wabaId: string;
  phoneNumberId: string;
  senderWaId: string;
  messageId: string;
  timestamp: number;
  messageType: "TEXT" | "TEMPLATE";
  textPreview: string | null;
};

export type NormalizedStatusUpdate = {
  kind: "status_update";
  messageId: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  timestamp: number;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
};

export type NormalizedWebhookEvent = NormalizedInboundMessage | NormalizedStatusUpdate;

const MAX_EVENTS = 120;
const MAX_TEXT_PREVIEW = 4_096;

function boundedPreview(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.length > MAX_TEXT_PREVIEW ? value.slice(0, MAX_TEXT_PREVIEW) : value;
}

/**
 * Parses and normalizes a validated webhook payload into bounded domain
 * events. Returns `null` for malformed/missing structures (the caller decides
 * the HTTP response). Unknown fields are ignored, never trusted.
 */
export function normalizeWebhook(raw: unknown): NormalizedWebhookEvent[] {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return [];

  const events: NormalizedWebhookEvent[] = [];
  for (const entry of parsed.data.entry ?? []) {
    const wabaId = entry.id ?? "";
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const { metadata, messages, statuses } = change.value;
      const phoneNumberId = metadata?.phone_number_id ?? "";
      if (!phoneNumberId) continue;

      for (const message of messages ?? []) {
        if (!message.id || !message.from) continue;
        const messageType = message.type === "template" ? "TEMPLATE" : "TEXT";
        const timestamp = Number(message.timestamp ?? 0);
        events.push({
          kind: "inbound_message",
          wabaId,
          phoneNumberId,
          senderWaId: message.from,
          messageId: message.id,
          timestamp: Number.isFinite(timestamp) ? timestamp : 0,
          messageType,
          textPreview: boundedPreview(message.text?.body),
        });
        if (events.length >= MAX_EVENTS) return events;
      }

      for (const status of statuses ?? []) {
        if (!status.id || !status.status) continue;
        const error = status.errors?.[0];
        const timestamp = Number(status.timestamp ?? 0);
        events.push({
          kind: "status_update",
          messageId: status.id,
          status: status.status.toUpperCase() as NormalizedStatusUpdate["status"],
          timestamp: Number.isFinite(timestamp) ? timestamp : 0,
          providerErrorCode: error?.code != null ? String(error.code).slice(0, 64) : null,
          providerErrorMessage: error?.message ? error.message.slice(0, 500) : null,
        });
        if (events.length >= MAX_EVENTS) return events;
      }
    }
  }
  return events;
}