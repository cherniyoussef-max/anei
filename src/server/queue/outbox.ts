import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { outboxEvent, type OutboxEventRow } from "@/server/db/schema";
import { isOutboxEventType, type OutboxEventType } from "@/server/queue/event-types";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Bounded so a misbehaving caller cannot grow the outbox table unboundedly with one payload. */
export const OUTBOX_MAX_PAYLOAD_BYTES = 8_192;
export const OUTBOX_DEFAULT_MAX_ATTEMPTS = 8;

export type EnqueueOutboxEventInput = {
  organizationId?: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: OutboxEventType;
  payload: Record<string, unknown>;
  /** Local idempotency boundary: a redelivered/retried enqueue for the same logical event is a no-op, never a duplicate row. */
  idempotencyKey: string;
  maxAttempts?: number;
};

/**
 * Inserts one outbox_event row. MUST be called with the caller's own
 * in-flight transaction (`tx`) so the business mutation and the durable
 * send-intent commit or roll back together — this function never opens its
 * own transaction. Idempotent on `idempotencyKey`: a concurrent/retried
 * enqueue of the same logical event returns the existing row rather than
 * erroring or creating a second job (enforced by the DB unique index, not
 * just application logic).
 */
export async function enqueueOutboxEvent(tx: DbClient, input: EnqueueOutboxEventInput): Promise<{ id: string; created: boolean }> {
  if (!isOutboxEventType(input.eventType)) throw new Error(`UNKNOWN_OUTBOX_EVENT_TYPE:${input.eventType}`);

  const serialized = JSON.stringify(input.payload);
  if (Buffer.byteLength(serialized, "utf8") > OUTBOX_MAX_PAYLOAD_BYTES) {
    throw new Error("OUTBOX_PAYLOAD_TOO_LARGE");
  }

  const [inserted] = await tx
    .insert(outboxEvent)
    .values({
      organizationId: input.organizationId ?? null,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      maxAttempts: input.maxAttempts ?? OUTBOX_DEFAULT_MAX_ATTEMPTS,
    })
    .onConflictDoNothing({ target: outboxEvent.idempotencyKey })
    .returning({ id: outboxEvent.id });

  if (inserted) return { id: inserted.id, created: true };

  const [existing] = await tx.select({ id: outboxEvent.id }).from(outboxEvent).where(eq(outboxEvent.idempotencyKey, input.idempotencyKey)).limit(1);
  if (!existing) throw new Error("OUTBOX_ENQUEUE_RACE_UNRESOLVED");
  return { id: existing.id, created: false };
}

export type { DbClient, OutboxEventRow };
