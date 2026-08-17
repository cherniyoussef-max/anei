import type { OutboxEventRow } from "@/server/db/schema";
import type { OutboxEventType } from "@/server/queue/event-types";

/** Bounded, sanitized error — never a raw HTTP response, header, token, or stack trace (see CLAUDE.md security invariants). `providerErrorCode` is the bounded numeric provider code (e.g. Meta's `132000`), carried only so local message rows can keep their diagnostic provider code; it is never a credential. */
export type SanitizedError = { code: string; message: string; providerErrorCode?: string | null };

export type HandlerOutcome =
  | { outcome: "SUCCEEDED" }
  | { outcome: "RETRYABLE"; error: SanitizedError }
  | { outcome: "NON_RETRYABLE"; error: SanitizedError };

export interface OutboxHandler<T> {
  readonly eventType: OutboxEventType;
  /** Validates the raw JSONB payload against this handler's versioned schema. A malformed/version-mismatched payload returns null and is treated as a poison job (NON_RETRYABLE), never thrown into the worker loop. */
  parsePayload(raw: unknown): T | null;
  /**
   * Performs the external side effect. Never called inside a DB transaction —
   * the worker has already committed the PENDING→PROCESSING claim before
   * invoking this. Must reload every authoritative fact it needs from the
   * database rather than trusting the payload (organization isolation: a
   * payload referencing org A's entity must never be usable to act against
   * org B's provider account, see CLAUDE.md security invariants).
   */
  handle(event: OutboxEventRow, payload: T): Promise<HandlerOutcome>;
  /** Invoked exactly once when the event reaches a terminal FAILED state (non-retryable classification, or retry attempts exhausted) — writes back local terminal state (e.g. marks a message FAILED) and scrubs any ephemeral secret material. */
  onTerminalFailure(event: OutboxEventRow, payload: T, error: SanitizedError): Promise<void>;
}
