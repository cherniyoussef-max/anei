# Security Model (Phase 0 — planning only)

Every rule below is additive to, and must not weaken, the security invariants already
enforced today: origin/CSRF checks on protected mutations, fresh DB-backed admin
sessions (`getFreshSession`), entitlement-before-signing storage access, server-to-
server payment verification (never trust a browser redirect), integer millimes, and
FR/AR localization. This document is the authoritative Phase 0 authorization map for
every new domain area; `ROADMAP.md` phases reference it rather than restating it.

## 1. Authorization matrix

| Actor | Own data | Same-organization data | Other-organization data | Cross-user (no relationship) | Admin-only data |
|---|---|---|---|---|---|
| Anonymous | — | — | — | — | denied |
| STUDENT | full (enrollments/progress/certs) | n/a unless org member | denied | denied | denied |
| TEACHER | full (assigned cohorts only, via `relationship`) | if org member: cohort roster | denied | denied | denied |
| AVS | own profile + assigned students (via `relationship`) | if org member: org AVS records | denied | denied | denied |
| PARENT | linked students only (via `relationship`) | n/a | denied | denied | denied |
| SPECIALIST | linked students only (via `relationship`) | n/a | denied | denied | denied |
| ORGANIZATION member (OWNER/MANAGER/STAFF) | org-scoped CRM/cohorts per role table in `PERSONA_CAPABILITY_MATRIX.md` | full within own org | denied | denied | denied |
| ORGANIZATION member (VIEWER) | read-only within own org | read-only within own org | denied | denied | denied |
| ADMIN | all (per existing `adminPermissions`) | all | all | all | all except SUPER_ADMIN-only actions |
| SUPER_ADMIN | all | all | all | all | all |

"Denied" means the query/route returns 403/404 (per existing convention of not
distinguishing "doesn't exist" from "not yours" where that distinction itself would
leak information — same as `getPurchasedResourceForDownload` returning nothing rather
than a distinguishable error for a non-owned resource).

## 2. IDOR risk register (new surfaces introduced by this blueprint)

| Surface | Risk | Mitigation |
|---|---|---|
| `relationship` creation | A parent/AVS/specialist self-declares a link to an arbitrary student by guessing/enumerating a `userId`. | Relationship rows are **admin/org-manager created only** — no route lets a subject create their own relationship row. `createdBy` is audited. `status` starts `PENDING` and requires explicit activation, giving a second control point before any data becomes visible. |
| `relationship`-scoped reads (parent/AVS/specialist portals) | A portal query accepts a client-supplied `studentId` instead of deriving it from the caller's own relationship rows. | Every portal query is shaped `requireRelationship(actorUserId=session.user.id, studentUserId, type)` — the target ID is checked *against* rows owned by the caller, never used as the sole authorization input, mirroring `getPurchasedResourceForDownload(session.user.id, resourceId)`. |
| `organizationId` path/body parameters | A STAFF member of org A submits org B's `organizationId` and reads/writes org B data. | `organizationId` is always validated against the caller's own `organizationMembership` row before any org-scoped query runs; never trusted as a bare authorization token. Regression test required per `ROADMAP.md` Phase 2. |
| CRM `contact`/`conversation`/`opportunity` IDs | Sequential/guessable ID enumeration across organizations. | All primary keys are UUIDs (`crypto.randomUUID()`, existing convention) — not sequential — plus explicit `organizationId` scoping on every query, not security-through-obscurity alone. |
| `accountInvitation` token | Token guessing/enumeration to self-create an account bypassing the admission funnel. | Token is high-entropy, stored only as a hash (`tokenHash`, mirrors `verification.value` handling), single-use enforced at the DB layer (`UPDATE ... WHERE consumedAt IS NULL`), and time-bounded (`expiresAt`). |
| `appointmentSlot` booking | Race condition oversells a slot past capacity (not IDOR, but a related IMPORTANT integrity risk). | Transactional row-lock + count check (`DATA_MODEL.md` constraint #5), concurrency-tested per `ROADMAP.md` Phase 4. |
| WhatsApp webhook payload | Spoofed webhook calls forge inbound messages / fake delivery status without holding Meta's signing secret. | `X-Hub-Signature-256` verified against `WHATSAPP_APP_SECRET` before any payload is trusted — identical discipline to `flouci.ts`'s `authorization()` check; unsigned/invalid-signature requests are rejected before touching the DB. |
| WhatsApp webhook replay | A redelivered (or maliciously replayed, if signature were ever compromised) webhook double-creates messages or double-fires automation (e.g., a duplicate WhatsApp send). | `metaMessageId`/`whatsappMessageId` uniqueness constraints make replay an idempotent no-op, test-covered per `ROADMAP.md` Phase 5, matching `payments_provider_external_unique`'s proven role for Flouci. |
| AI retrieval (`Retriever`) | A knowledge chunk sourced from a paid course/resource is retrievable by a non-entitled user via a crafted prompt. | `Retriever` implementations filter `knowledgeChunk` by the same `enrollments`/`purchases` entitlement checks already used elsewhere before any chunk reaches the LLM — per the existing interface's own doc comment; regression-tested per `ROADMAP.md` Phase 10, directly modeled on this session's resource-entitlement IDOR tests. |
| AI tool execution | A crafted prompt induces an `AiTool` to perform a privileged action (enroll, refund, message-send, role change) the calling user isn't authorized for. | Every `AiTool.execute` independently re-authorizes using the real caller identity from `AiToolContext`, exactly as a human-triggered route would — the model's output is never treated as an authorization decision, per the existing `ToolRegistry` interface's own comment ("every tool must authorize independently of the LLM") and `AI_ARCHITECTURE.md`'s explicit statement that the model is never an authorization layer. |
| `enrollments.source` | Client-supplied `source` value used to bypass payment (e.g., a crafted request sets `source=PAYMENT` without a real order). | `source` is never accepted as client input on any learner-facing route — it is set exclusively by server-side service functions (`createOrderCheckout`'s completion path sets `PAYMENT`; the admission funnel's enroll step sets `TEST_PASS`; admin/org bulk-enroll routes set `ADMIN`/`ORGANIZATION`, gated by the existing admin/org-manager permission checks). |

## 3. Cross-persona / cross-organization matrix (explicit denial cases)

- A `TEACHER` of course X must not see cohort rosters for course Y they are not
  assigned to, even if both courses share an organization — scoping is per
  `relationship` row, not per organization membership alone.
- A `PARENT` linked to student A must not see student B's data even if both students
  are in the same cohort/organization — scoping is per `relationship` row, not per
  cohort membership.
- An `ORGANIZATION` `VIEWER` must not be able to mutate anything, including CRM notes
  or cohort rosters, despite having read access to the same data a `STAFF` member can
  write.
- A `SPECIALIST`/`AVS` relationship in `PENDING` status must not grant any data access
  — only `ACTIVE` status does; this is the second control point referenced in §2's
  `relationship`-creation mitigation.
- A converted `contact` (now a `user`) must not remain independently queryable as a
  live "lead" in pipeline views once `convertedUserId` is set — pipeline/CRM UI must
  filter or clearly distinguish converted contacts to avoid stale/duplicate-looking
  records being acted on.

## 4. WhatsApp-specific security requirements

- Signature verification (§2) is mandatory and gates all further processing.
- Outbound template (marketing/re-engagement) sends require an active `whatsappOptIn`
  row (`optedOutAt IS NULL`); session messages within Meta's 24h customer-service
  window do not require opt-in but do require an existing open `conversation`.
- OTP codes (Phase 6): never logged, stored hashed, compared in constant time, rate-
  limited per contact/phone, and bounded-attempt (lock out after N wrong attempts,
  mirroring sign-in rate limiting).
- Message bodies are not logged in structured application logs beyond what is needed
  for operational debugging with PII redaction — this extends `CLAUDE.md`'s "never log
  tokens/OTPs/signed URLs" rule to WhatsApp message content generally.

## 5. Secrets handling

- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
  `CLOUDFLARE_STREAM_API_TOKEN`, `LLM_PROVIDER_API_KEY`: server-only environment
  variables, validated by `src/server/env.ts`'s existing Zod schema pattern, never
  exposed to client bundles, never returned in any API response, never included in
  audit log `metadata` payloads.
- Cloudflare Stream signed playback tokens and WhatsApp message IDs are safe to persist
  (they are not credentials), but are still not logged verbatim in access logs beyond
  what operational debugging requires — same posture as today's signed S3 URLs (`docs/
  MEDIA.md`: "permanent public object URLs are not used").

## 6. Audit requirements

Every new mutation route that changes authorization-relevant state must write an
`auditLogs` row, exactly matching the existing convention
(`admin/avs/route.ts`'s `db.insert(auditLogs).values({ actorUserId, action,
entityType, entityId, metadata })`):
- `relationship.create` / `relationship.revoke`
- `organizationMembership.create` / `.role.change` / `.remove`
- `accountInvitation.create` / `.consume`
- `assessmentAttempt.result.set`
- `enrollments.source=ADMIN|ORGANIZATION` grants
- `personaMembership.grant` / `.revoke` (admin-initiated)

This directly extends the precedent set by this session's own prior audit work
(`fix(admin): audit privileged password reset actions`, `fix(admin): invalidate user
caches after role changes`) — privileged state changes affecting another user's access
are always audited and cache-invalidated where applicable.

## 7. What Phase 0 explicitly does not weaken

- Better Auth remains the sole identity/session system; no parallel auth mechanism is
  introduced for CRM contacts (contacts are not authenticatable until converted to a
  `user`).
- No Row-Level-Security-style implicit authorization is adopted — every new query is
  explicitly scoped in application code, matching ANEI's existing convention and this
  session's own audit findings for storage.
- No new route trusts client-supplied identity, amount, status, or authorization scope
  fields — every such value is either server-derived or checked against a caller-owned
  row.
- No AI or automation path gains authorization powers a human-triggered equivalent
  route wouldn't already require.
