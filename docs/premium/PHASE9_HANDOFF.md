# Phase 9 Handoff — PostgreSQL Transactional Outbox + Separate Worker + Async WhatsApp Delivery

## Scope implemented

- PostgreSQL transactional outbox (`outbox_event` table) with a dedicated worker process for durable, at-least-once, eventually-delivered WhatsApp template messages.
- Invitation and OTP sends now enqueue inside the same transaction as the business mutation and are delivered by the worker instead of synchronously.
- `sendWhatsAppTemplate` is no longer synchronous: it writes a `QUEUED` message + an outbox job in one transaction and returns immediately; the worker drives `QUEUED → SENT | FAILED`.

## Architecture

- `scripts/worker.ts` — standalone process (`npm run worker:outbox` = `tsx --conditions=react-server`). Poll loop (default 2s, `OUTBOX_POLL_INTERVAL_MS`), batch size (`OUTBOX_BATCH_SIZE`, bounded 1–50, default 10), SIGTERM/SIGINT graceful shutdown (finishes current cycle then exits). Logs only sanitized cycle counts, never payload/secret content.
- `src/server/queue/worker-engine.ts` — `runOutboxCycle({ organizationId?, leaseSeconds? })`. Claim: `FOR UPDATE SKIP LOCKED`, atomically claims only PENDING-with-availableAt-past OR PROCESSING-with-expired-lease rows, sets `lockedAt`/`lockedBy`/`attempts+1`, commits, then processes OUTSIDE the claim transaction (long provider calls never hold the row lock). Write-back: success → `SUCCEEDED` + `processedAt`; retryable → back to `PENDING` with exponential `availableAt` (base 5s, max 3600s, capped by `maxAttempts`, default 8); terminal → `FAILED` with sanitized error, `handler.onTerminalFailure`. Unexpected handler throw → `RETRYABLE` with `HANDLER_UNEXPECTED_ERROR`.
- `src/server/queue/outbox.ts` — `enqueueOutboxEvent(tx, ...)` inserts the outbox row inside the caller's transaction (never called outside one). `claimNextEvents`/`releaseClaim` are exported for tests.
- `src/server/queue/event-types.ts` — `OutboxEventType`/payload schemas with a `satisfies`-typed schema map so `parseOutboxPayload` infers the precise payload type per event.
- `src/server/queue/handlers/index.ts` + `whatsapp-template-send.ts` — per-event handlers; `onTerminalFailure` records the failed message + activity. Handler reloads authoritative data from the DB (message, org account, template) — the payload carries only `{ messageId }`.
- `src/server/security/outbox-crypto.ts` — AES-256-GCM array encryption for `body_parameters_encrypted`; decrypts only inside the worker.

## Delivery semantics

- At-least-once: a crash between provider success and write-back re-delivers (duplicate provider sends are possible). No exactly-once guarantee is claimed.
- Idempotency: `enqueueTemplateMessage` uses `whatsapp-message:<messageId>` so the same request never yields a second job; `sendWhatsAppTemplate`'s `requestId` scoping is unchanged.
- Stale-lease recovery: PROCESSING rows older than the lease are re-claimed (an "attempt" each time), bounded by `maxAttempts`. Test-proven with a 1s lease against a simulated crashed worker.
- Concurrency: `FOR UPDATE SKIP LOCKED` guarantees two workers never claim the same row (test-proven with concurrent cycles).
- Cross-org safety: the handler scopes the message lookup to `event.organizationId`; a forged row under org A referencing org B's message terminates with `MESSAGE_NOT_FOUND` and sends nothing (test-proven).
- Poison payload: schema-invalid payload fails non-retryably (`INVALID_PAYLOAD`), never thrown into the loop (test-proven).

## Secrets handling

- OTP digit strings and invitation URL + org name are AES-256-GCM encrypted at rest in `whatsapp_message.body_parameters_encrypted`, decrypted only in the worker at send time, scrubbed to `null` after a successful send, and never logged. The worker fetch stub tests assert only decrypted values reach the provider body and no plaintext OTP ever appears in DB/audit.

## Errors

- Retryable: HTTP 5xx, network/timeout, `INVALID_RESPONSE` (e.g., Meta 500 with a non-JSON body). Terminal: provider rejections such as Meta `132000` (template not approved). `SanitizedError` carries an optional `providerErrorCode` so `whatsapp_message.provider_error_code` keeps the raw Meta code (e.g. `132000`) while the public message stays sanitized.
- Terminal failure writes `WHATSAPP_FAILED` activity and sets the message `FAILED` with the provider code; no audit row is written for the failed attempt (delivery failures are recorded on the message + activity, matching the pre-Phase-9 failure contract).

## Config / env

`OUTBOX_BATCH_SIZE` (1–50, default 10), `OUTBOX_POLL_INTERVAL_MS` (100–60000, default 2000). Existing `ENABLE_WHATSAPP`/WhatsApp secrets config is unchanged and still gates the provider; the worker fails closed if a send can't resolve an org account/template.

## Migration

`drizzle/0013_outbox_events.sql` — `outbox_event` table (org-scoped FK, status CHECK, attempts/non-negative, `locked_by`/`locked_at`/`available_at`, `processed_at`, `last_error_code`/`message` max lengths, event-type + payload, idempotency key with partial unique index, `claimable` expression index). Hand-authored matching the 0001–0012 convention, applied and verified against the local dev DB; migrations 0000–0012 unchanged.

## Important files

- `scripts/worker.ts`, `package.json` (`worker:outbox`)
- `src/server/queue/{outbox,worker-engine,event-types,handler-types}.ts`, `src/server/queue/handlers/{index,whatsapp-template-send}.ts`
- `src/server/security/outbox-crypto.ts`
- `src/server/services/whatsapp.ts` (`enqueueTemplateMessage`, `enqueueSystemWhatsAppTemplateWithSecretParameters`, `recordOutboundSent`, `recordOutboundFailure`)
- `src/server/services/account-invitations.ts` (invitation/OTP enqueue inside business transactions)
- `src/server/db/schema.ts` (`outbox_event`), `drizzle/0013_outbox_events.sql`
- `tests/integration/helpers/outbox.ts` (`drainOutboxForOrg`)

## Tests / results

- `tests/integration/outbox-worker.test.ts` (10/10, real DB): PENDING claim + write-back, HTTP 5xx retryable with backoff, provider rejection terminal with raw code, maxAttempts exhaustion, stale-lease recovery, concurrent SKIP LOCKED, poison payload, cross-org forgery, idempotent enqueue, encrypted OTP delivery.
- `tests/integration/whatsapp.test.ts` (14/14): send tests now drive the worker (`drainOutboxForOrg`) to assert `QUEUED → SENT/FAILED`.
- `tests/integration/account-invitations.test.ts` (14/14): invitation/OTP flows capture the worker-delivered token/OTP inside the fetch-stub window; cleanup deletes `outbox_event` first.
- Full suite: `test:unit` 159/159, `test:security` 3/3, `test:integration` 169/169 (parallel, org-scoped cycles), all pass. `typecheck` clean, `build` clean, `deps:check` pass, `security:audit` pass, `git diff --check` clean.
- `lint`: exactly the 5 pre-existing `no-explicit-any` errors in `src/modules/admin/queries/admin-users.ts` — zero new problems (`REAL_LINT_EXIT=1` = baseline).

## Test-pattern note

Integration test files run in parallel as separate processes against the shared test DB. Every test worker cycle is org-scoped (`runOutboxCycle({ organizationId })` / `drainOutboxForOrg`) and each test uses unique provider ids so parallel runs can't collide.

## Known debt / deferred

- No dead-letter queue / manual retry UI: terminal FAILED rows stay in `outbox_event` for inspection; re-enqueuing a message re-creates the job.
- `recordOutboundSent`/`recordOutboundFailure` retry via the at-least-once guarantee; a rare double `SENT` write is possible if the process dies between provider success and write-back.
- Worker has no metrics export; observability is log-only (cycle counts). Backpressure is bounded by batch size + poll interval, not a queue-depth watermark.
- Enqueue-to-delivery is now asynchronous by design; a `QUEUED` message can be observed immediately after the API returns (previously synchronous SENT). Any client that assumed immediate `SENT` must observe the worker's terminal state instead.

## Phase 10 boundary

No webhook-triggered sends, no scheduled/digest sends, no outbox admin UI, no multi-worker deployment scripts, and no consumer/metrics pipeline were added. The outbox currently carries only `WHATSAPP_TEMPLATE_SEND` events.