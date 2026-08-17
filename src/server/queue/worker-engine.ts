import "server-only";
import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/server/db";
import { outboxEvent, type OutboxEventRow } from "@/server/db/schema";
import { outboxHandlers } from "@/server/queue/handlers";
import type { HandlerOutcome } from "@/server/queue/handler-types";
import type { OutboxEventType } from "@/server/queue/event-types";

/**
 * Phase 9 outbox worker engine — the separate process
 * (scripts/worker.ts) polls this in a loop. Design rules:
 *
 * - Claim with `SELECT ... FOR UPDATE SKIP LOCKED` inside a SHORT transaction:
 *   competing worker processes (or workers in the same process) never block
 *   each other and never double-claim the same row. The claim marks the row
 *   PROCESSING with a lease (lockedAt + lockedBy) and increments attempts,
 *   then commits — the DB lock is released BEFORE any external call.
 * - Stale-lease recovery: a PROCESSING row whose lease has expired
 *   (lockedAt older than OUTBOX_LEASE_SECONDS) is eligible again; the
 *   previous worker may have crashed mid-call. This is the documented
 *   at-least-once window (see docs/premium/PHASE9_HANDOFF.md) — we never
 *   claim exactly-once external delivery.
 * - The external side effect runs AFTER the claim commits, outside any DB
 *   transaction, so a slow/hung provider call can never hold a row lock.
 * - Outcomes are written back with a guard (`status='PROCESSING' AND
 *   locked_by=this worker`) so a lease that was reclaimed by another worker
 *   while we were mid-call can never be clobbered into SUCCEEDED.
 */

export const OUTBOX_BATCH_SIZE = 10;
export const OUTBOX_LEASE_SECONDS = 300;
export const OUTBOX_BACKOFF_BASE_SECONDS = 5;
export const OUTBOX_BACKOFF_MAX_SECONDS = 3600;

export type OutboxCycleResult = {
  claimed: number;
  succeeded: number;
  retried: number;
  terminal: number;
  skipped: number;
};

export function backoffSeconds(attemptNumber: number): number {
  const exponent = Math.min(Math.max(0, attemptNumber - 1), 16);
  return Math.min(OUTBOX_BACKOFF_BASE_SECONDS * 2 ** exponent, OUTBOX_BACKOFF_MAX_SECONDS);
}

export async function runOutboxCycle(options?: {
  batchSize?: number;
  leaseSeconds?: number;
  workerId?: string;
  organizationId?: string;
}): Promise<OutboxCycleResult> {
  const batchSize = Math.min(Math.max(1, options?.batchSize ?? OUTBOX_BATCH_SIZE), 50);
  const leaseSeconds = options?.leaseSeconds ?? OUTBOX_LEASE_SECONDS;
  const workerId = options?.workerId ?? `worker-${crypto.randomUUID()}`;
  const leaseCutoff = new Date(Date.now() - leaseSeconds * 1000);

  // 1) Claim a bounded batch (FOR UPDATE SKIP LOCKED) inside one short
  //    transaction; the lease fields + attempt counter are set here.
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(outboxEvent)
      .where(
        and(
          options?.organizationId ? eq(outboxEvent.organizationId, options.organizationId) : undefined,
          or(
            and(eq(outboxEvent.status, "PENDING"), lte(outboxEvent.availableAt, new Date())),
            and(eq(outboxEvent.status, "PROCESSING"), lt(outboxEvent.lockedAt, leaseCutoff)),
          ),
        ),
      )
      .orderBy(asc(outboxEvent.availableAt), asc(outboxEvent.createdAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    await tx
      .update(outboxEvent)
      .set({
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: sql`${outboxEvent.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(inArray(outboxEvent.id, ids));
    return rows;
  });

  // 2) Process each claimed event OUTSIDE the transaction (no DB locks held
  //    during provider I/O). Handlers reload authoritative facts themselves.
  const result: OutboxCycleResult = { claimed: claimed.length, succeeded: 0, retried: 0, terminal: 0, skipped: 0 };
  for (const event of claimed) {
    const outcome = await processClaimedEvent(event, workerId);
    result[outcome] += 1;
  }
  return result;
}

type ProcessOutcome = "succeeded" | "retried" | "terminal" | "skipped";

async function processClaimedEvent(event: OutboxEventRow, workerId: string): Promise<ProcessOutcome> {
  const handler = outboxHandlers[event.eventType as OutboxEventType];
  if (!handler) {
    await writeBack(event.id, workerId, {
      status: "FAILED",
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: "UNKNOWN_EVENT_TYPE",
      lastErrorMessage: `No handler registered for event type '${event.eventType}'`,
      updatedAt: new Date(),
    });
    return "terminal";
  }

  const payload = handler.parsePayload(event.payload);
  if (!payload) {
    // Poison job (malformed/version-drifted payload) — non-retryable by
    // definition; never throw into the worker loop.
    await writeBack(event.id, workerId, {
      status: "FAILED",
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: "POISON_PAYLOAD",
      lastErrorMessage: "Payload failed schema validation",
      updatedAt: new Date(),
    });
    return "terminal";
  }

  let outcome: HandlerOutcome;
  try {
    outcome = await handler.handle(event, payload);
  } catch (error) {
    outcome = { outcome: "RETRYABLE", error: sanitizeUnexpected(error) };
  }

  if (outcome.outcome === "SUCCEEDED") {
    await writeBack(event.id, workerId, {
      status: "SUCCEEDED",
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: new Date(),
    });
    return "succeeded";
  }

  if (outcome.outcome === "NON_RETRYABLE") {
    await onTerminal(event, workerId, payload, outcome.error, handler);
    return "terminal";
  }

  // RETRYABLE: bounded by maxAttempts (already incremented at claim time).
  const attemptNumber = event.attempts + 1;
  if (attemptNumber >= event.maxAttempts) {
    await onTerminal(event, workerId, payload, outcome.error, handler);
    return "terminal";
  }
  const availableAt = new Date(Date.now() + backoffSeconds(attemptNumber) * 1000);
  await writeBack(event.id, workerId, {
    status: "PENDING",
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: outcome.error.code,
    lastErrorMessage: outcome.error.message.slice(0, 500),
    updatedAt: new Date(),
    availableAt,
  });
  return "retried";
}

async function onTerminal(
  event: OutboxEventRow,
  workerId: string,
  payload: unknown,
  error: { code: string; message: string },
  handler: (typeof outboxHandlers)[OutboxEventType],
): Promise<ProcessOutcome> {
  try {
    await handler.onTerminalFailure(event, payload as never, error);
  } catch {
    // The terminal write-back must still happen even if the handler's
    // onTerminalFailure (e.g. a local activity/audit insert) fails.
  }
  await writeBack(event.id, workerId, {
    status: "FAILED",
    processedAt: new Date(),
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: error.code,
    lastErrorMessage: error.message.slice(0, 500),
    updatedAt: new Date(),
  });
  return "terminal";
}

function sanitizeUnexpected(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return { code: "HANDLER_UNEXPECTED_ERROR", message: error.message.slice(0, 300) || "Unexpected handler error" };
  }
  return { code: "HANDLER_UNEXPECTED_ERROR", message: "Unexpected non-Error thrown by handler" };
}

type WriteBack = {
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  processedAt?: Date | null;
  lockedAt: null;
  lockedBy: null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: Date;
  availableAt?: Date;
};

async function writeBack(eventId: string, workerId: string, patch: WriteBack): Promise<void> {
  await db
    .update(outboxEvent)
    .set({
      status: patch.status,
      processedAt: patch.status === "PENDING" ? null : patch.processedAt,
      lockedAt: patch.lockedAt,
      lockedBy: patch.lockedBy,
      lastErrorCode: patch.lastErrorCode,
      lastErrorMessage: patch.lastErrorMessage,
      updatedAt: patch.updatedAt,
      availableAt: patch.availableAt,
    })
    .where(and(eq(outboxEvent.id, eventId), eq(outboxEvent.status, "PROCESSING"), eq(outboxEvent.lockedBy, workerId)));
}