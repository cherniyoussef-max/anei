# Phase 5 — Official Meta WhatsApp Cloud API Foundation

Status: **READY_FOR_INDEPENDENT_REVIEW**
Branch: `main` · Last commit: `122d717` · Migrations: `0008`, `0009` applied

This document reports what was built for Phase 5 of `docs/premium/ROADMAP.md`
(Meta WhatsApp Cloud API core integration). It is written for a reviewer who
can independently re-run the test suite and re-inspect the diff.

---

## 1. Scope delivered

The core WhatsApp communication channel:

- **Provider boundary** — a single `WhatsAppProvider` abstraction over the
  official Meta Cloud API (Graph `v22.0`, configurable), never a vendor SDK.
- **Org-scoped configuration** — one `whatsapp_account` row per organization
  carrying only non-secret provider metadata; the Meta credential stays in
  deployment env and is never persisted.
- **Outbound template sends** — staff-initiated, approved-template-only,
  bounded body parameters, server-resolved destination (a CRM contact's
  phone). Template catalog sync from Meta.
- **Webhook intake** — Meta's signed POST receiver (signature before parse),
  GET verification handshake, inbound message ingestion, delivery/read/failed
  status callbacks.
- **Idempotency** — durable per-event ledger (dedup insert + side effects in
  one transaction) for webhooks; per-org `localRequestId` for outbound sends.
- **Message history** — org-scoped, filtered, paginated, with CRM contact
  joined on.
- **CRM activity** — `WHATSAPP_TEMPLATE_SENT`, `WHATSAPP_MESSAGE_RECEIVED`,
  `WHATSAPP_FAILED` on the contact timeline.
- **Admin UI** — account configuration, template list, message history table
  with filters/pagination, and a send form on
  `/{locale}/admin/crm/{orgId}/whatsapp`, plus a read-only WhatsApp section on
  the contact detail page.

Explicitly **not** in Phase 5 (deferred to later phases): OTP/opt-in
(Phase 6), queue/outbox worker (Phase 9), and free-form session messaging
(templates only).

## 2. Deliverables

### New files

```
src/modules/whatsapp/domain/permissions.ts     state machine + org gates
src/server/whatsapp/contracts.ts               provider contract + bounded errors
src/server/whatsapp/config.ts                  env-derived config, never logs secrets
src/server/whatsapp/phone.ts                   wa_id normalization / matching
src/server/whatsapp/webhook.ts                 signature + challenge verification
src/server/whatsapp/normalize.ts               bounded payload normalization
src/server/whatsapp/meta.ts                    MetaWhatsAppCloudProvider (fetch-only)
src/server/queries/whatsapp.ts                 org-scoped queries
src/server/services/whatsapp.ts                account upsert, template sync, send
src/server/services/whatsapp-webhook.ts        webhook ingestion
src/app/api/webhooks/whatsapp/route.ts         Meta webhook receiver
src/app/api/admin/crm/whatsapp/account/route.ts
src/app/api/admin/crm/whatsapp/templates/route.ts
src/app/api/admin/crm/whatsapp/messages/route.ts
src/app/api/admin/crm/whatsapp/send/route.ts
src/app/[locale]/admin/crm/[orgId]/whatsapp/page.tsx
src/components/admin/AdminWhatsAppAccountForm.tsx
src/components/admin/AdminWhatsAppSendForm.tsx
src/components/admin/AdminWhatsAppContactSection.tsx
drizzle/0008_whatsapp_foundation.sql           applied
drizzle/0009_whatsapp_request_id_org_scoped.sql applied
tests/unit/whatsapp-webhook-route.test.ts
tests/unit/whatsapp-webhook-primitives.test.ts
tests/unit/whatsapp-phone.test.ts
tests/unit/whatsapp-status.test.ts
tests/unit/whatsapp-provider.test.ts
tests/unit/whatsapp-route-contracts.test.ts
tests/integration/whatsapp.test.ts
```

### Modified files

```
src/server/db/schema.ts          whatsappAccount/Template/Message/WebhookEvent
src/server/env.ts                WhatsApp env vars + production guard
.env.example                     WhatsApp env vars
src/modules/crm/domain/permissions.ts   3 WhatsApp activity types
src/server/security/request-body.ts     readLimitedRawBody
src/app/[locale]/admin/crm/[orgId]/page.tsx             nav link
src/app/[locale]/admin/crm/[orgId]/contacts/[contactId]/page.tsx  WhatsApp section
tests/unit/request-body.test.ts  raw-body reader tests
```

## 3. Data model (migrations 0008 + 0009)

- `whatsapp_account` — org-scoped provider metadata: `phoneNumberId`
  (globally unique on Meta), `businessAccountId`, `displayPhoneNumber`,
  `status`, `provider`. No secrets. Unique per `phoneNumberId`.
- `whatsapp_template` — org-scoped mirror of the provider catalog (name,
  language, category, status, `parameterCount`), unique on
  `(organization_id, name, language)`.
- `whatsapp_message` — direction/messageType/status (DB CHECK-enforced),
  optional `contactId` (inbound may be unresolved), `providerMessageId`
  (unique), `localRequestId`, timestamps `sentAt/deliveredAt/readAt/failedAt`,
  bounded `textPreview` (4 096), bounded provider error fields. History
  survives contact deletion (`ON DELETE SET NULL`).
- `whatsapp_webhook_event` — idempotency ledger, unique `stableKey`
  (`message:<wamid>` / `status:<wamid>:<status>`), event type CHECK.

`0009` rebuilds the outbound idempotency index as
`(organization_id, local_request_id)` so each organization owns its request-id
namespace (see §6).

## 4. Status state machine

`QUEUED < SENT < DELIVERED < READ`; `FAILED` is terminal and only reachable
from `QUEUED`/`SENT` (an already-delivered/read message can never flip to
failed — a contradictory out-of-order callback is ignored). `canApplyMessageStatus`
rejects replays and regressions; ignored callbacks are still durably
ledgered so they are never re-processed.

## 5. Security model

- **Webhook authenticity**: `POST /api/webhooks/whatsapp` verifies
  `X-Hub-Signature-256` (HMAC-SHA256 of the **raw** received bytes keyed with
  the Meta app secret, constant-time compare) **before** parsing. The raw body
  is read under a 256 KB ceiling (`readLimitedRawBody`); declared and actual
  sizes are both bounded. Missing/malformed signatures and any length mismatch
  fail closed (401). The GET handshake echoes `hub.challenge` only on
  `hub.mode=subscribe` + matching verify token.
- **Rate limiting**: per-IP webhook rate limit before signature verification
  (429 with `Retry-After`); admin mutations reuse `adminMutationRateLimit`.
- **Admin authorization**: mutation routes enforce `isTrustedMutation` →
  `getAdminSessionFor("crm.manage")` → rate limit → bounded JSON → strict zod
  → server-side org-role gate (`canManageWhatsappConfig` = MANAGER+ for
  account/templates, `canManageWhatsappMessages` = STAFF+ for sends). Reads
  require `crm.read`. Server-side authorization is never delegated to UI
  visibility.
- **Org isolation**: every query/mutation is org-scoped. The send flow
  resolves the provider account and destination server-side from the
  organization; clients may only supply contact/template ids, a language and a
  bounded list of parameter strings. Raw Meta payload injection is impossible
  by construction.
- **Secrets**: the Meta access token, app secret and verify token live only in
  deployment env; `whatsapp_account` rows never contain them. Integration
  tests assert no secret string is stored. Provider errors are mapped to
  bounded domain errors — raw provider error objects (which may echo request
  config/authorization headers) are never returned to callers.
- **Bounds**: webhook payloads ≤ 120 events, ≤ 20 entries, ≤ 100 messages/
  statuses per change, ids ≤ 256 (over-long ids reject the event), message
  bodies ≤ 50 000 then truncated to a 4 096 preview, error details ≤ 500.
- **Fail-closed behavior**: not configured → sends return `NOT_CONFIGURED`
  (503), the feature is disabled safely, and unrelated LMS functionality is
  unaffected. Unknown webhook accounts/events are counted, acknowledged (200)
  and never stored — Meta may deliver events for numbers configured in another
  deployment.

## 6. Adversarial findings fixed during review

- **Cross-org requestId collision (org isolation)**: the outbound idempotency
  lookup and its unique index were global on `localRequestId`. If org B reused
  a requestId string org A had already finalized, org B's send silently
  resolved to org A's message. Fixed by scoping both the lookup
  (`src/server/services/whatsapp.ts`) and the unique index
  (`0009_whatsapp_request_id_org_scoped.sql`) to `(organization_id,
  local_request_id)`, with a dedicated integration test.
- **FAILED-after-READ regression**: `canApplyMessageStatus` allowed a `failed`
  callback to flip an already-delivered/read message to FAILED. Corrected to
  accept FAILED only from QUEUED/SENT; unit + integration tests updated.

## 7. Known limitation (documented, deferred to Phase 9)

Outbound sends perform the Meta call synchronously. The local row is
persisted (QUEUED) before the provider call and the result is written back
after. A successful provider send followed by a failed local write-back leaves
the row QUEUED without a provider message id — the send happened but history
is incomplete. A retry reusing the same request id re-attempts the send
(no provider id stored), so recovery is possible; however a durable
queue/outbox that decouples the provider call from the request is Phase 9
scope. This is documented in the `sendWhatsAppTemplate` JSDoc.

## 8. Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run test:unit` | 142 pass / 0 fail |
| `npm run test:integration` | 118 pass / 0 fail (incl. 12 WhatsApp integration tests) |
| `npm run test:security` | 3 pass / 0 fail |
| `npm run lint` | only the 5 pre-existing baseline errors in `src/modules/admin/queries/admin-users.ts` (untouched); zero new issues |
| `npm run deps:check` | pass |
| `npm run security:audit` | pass (286 files) |
| `npm run build` | pass |
| `npm run check` | 5 pre-existing baseline errors only |
| `git diff --check` | clean |

Integration coverage includes: account upsert/update with no secrets stored,
role gating, QUEUED→SENT write-back + CRM activity + audit, provider rejection
→ FAILED + `WHATSAPP_FAILED`, requestId idempotency (no re-send), no-phone
fail-closed, inbound ingest + contact resolution + replay dedup, unknown
account never stored, monotonic status callbacks, ON DELETE SET NULL history,
DB CHECK constraints, concurrent stable-key uniqueness, and per-org requestId
isolation.

## 9. Notes for the reviewer

- Run `npm run test:integration` against the local PostgreSQL
  (`postgresql://anei:anei@127.0.0.1:5432/anei`); migrations `0008`/`0009`
  are already applied and the runner rejects modified applied migrations.
- Nothing is staged or committed. The working tree holds 28 changed/new files
  plus the two migration SQL files.
- Phase 6 (OTP/opt-in) and Phase 9 (queue/outbox) were intentionally not
  implemented.