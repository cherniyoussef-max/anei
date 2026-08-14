# Roadmap (Phase 0 — planning only)

14 phases. Each phase is independently shippable, migrates additively (no destructive
schema change to existing tables), and must pass the verification commands in
`CLAUDE.md` (`npm run typecheck`, `npm run lint`, `npm run test`, targeted tests,
`npm run build` for compilation-affecting changes) before merge. "Reuses" lists existing
ANEI components each phase must not duplicate.

---

## Phase 1 — Personas

- **Goal**: introduce `personaMembership` as the multi-persona-per-user model, migrate
  existing `profileType` values into it, without touching `user.role` semantics.
- **Tables**: `personaMembership` (`DATA_MODEL.md` §1).
- **APIs**: `GET /api/account/personas` (self), `POST /api/admin/users/[id]/personas`
  (admin-managed persona grants, mirrors `admin/users/[id]/role/route.ts`).
- **UI**: profile page shows persona list; signup form unchanged (still sets one primary
  persona, same `AuthForm.tsx` flow, now also inserting a `personaMembership` row).
- **Migrations**: new table + backfill (data migration script, not a schema-only
  change) + partial unique index for "one primary."
- **Security requirements**: only admin can grant/revoke a persona; a user reads only
  their own persona rows (`session.user.id`-scoped, per existing convention).
- **Tests**: integration test seeding a user then asserting persona backfill; unit test
  for the "at most one primary" constraint (attempt two primaries, expect DB
  constraint violation) — behavioral, mirroring `storage-authorization.test.ts`'s style.
- **Dependencies**: none (first phase).
- **Rollback**: drop `personaMembership` table; `user.profileType` remains
  authoritative and untouched throughout, so rollback has no data-loss risk.
- **Definition of Done**: every existing user has exactly one primary persona row
  matching their `profileType`; new signups create both; admin can grant a second
  persona; full test suite green.
- **Reuses**: `enforceNewUserDefaults()` (`src/server/auth/policy.ts`) extended, not
  replaced; `admin/users/[id]/role/route.ts` as the pattern for the new admin route.

## Phase 2 — Organizations

- **Goal**: multi-tenant organization + membership model with OWNER/MANAGER/STAFF/VIEWER
  roles.
- **Tables**: `organization`, `organizationMembership` (`DATA_MODEL.md` §2).
- **APIs**: `POST/GET /api/admin/organizations`, `POST /api/admin/organizations/[id]/
  members`, `GET /api/organizations/[id]` (member-scoped).
- **UI**: admin organization management screens (list/create/manage members), mirroring
  existing `admin/courses`/`admin/webinars` CRUD screens.
- **Migrations**: two new tables, no existing-table changes.
- **Security requirements**: `organizationId` is always resolved from the caller's own
  `organizationMembership` row for member-facing routes; admin routes gate on
  `getAdminSessionFor("organizations.manage")` (new permission, added to
  `adminPermissions`).
- **Tests**: integration test for cross-organization denial (user in org A cannot read
  org B's data even with a valid org B id in the URL) — this is the phase's primary
  IDOR regression target.
- **Dependencies**: none (independent of Phase 1, can ship in parallel).
- **Rollback**: drop both tables; nothing else references them yet at this phase.
- **Definition of Done**: an OWNER can invite a MANAGER; a VIEWER cannot mutate; cross-
  org access denied and covered by a regression test.
- **Reuses**: `hasAdminPermission()` pattern for the new `organizations.manage`
  permission; `adminMutationRateLimit`/`isTrustedMutation`/`readLimitedJson` on every
  new mutation route, unchanged.

## Phase 3 — CRM

- **Goal**: contacts, tags, notes, conversations, messages, pipeline/opportunities.
- **Tables**: `contact`, `contactTag`, `contactNote`, `conversation`, `message`,
  `opportunity` (`DATA_MODEL.md` §5).
- **APIs**: `admin/contacts` CRUD (note: existing `admin/contacts/[id]/route.ts` today
  manages `contactMessages`, the public contact-form inbox — this is a **different**
  table; the new CRM contact API must live at a distinct path, e.g.
  `admin/crm/contacts`, to avoid confusing the two "contacts" concepts), plus
  `admin/crm/conversations`, `admin/crm/opportunities`.
- **UI**: admin CRM screens — contact list/detail, conversation inbox, pipeline board.
- **Migrations**: new tables only.
- **Security requirements**: all CRM data is admin/organization-staff-scoped only
  (never exposed to a public/learner route); `organizationId`-scoped for org-owned
  contacts, global for ANEI-direct contacts (`organizationId IS NULL`).
- **Tests**: integration test proving a STAFF member of org A cannot list org B's
  contacts; unit test on the contact→user conversion transaction (converted contact
  gets `convertedUserId` set exactly once, second conversion attempt rejected by the
  `UNIQUE (convertedUserId)` constraint).
- **Dependencies**: Phase 2 (organization-scoping) should land first, though `contact`
  itself tolerates `organizationId IS NULL` so CRM can ship before every org feature is
  complete if needed.
- **Rollback**: drop CRM tables; no existing table is modified.
- **Definition of Done**: admin can create/tag/note a contact, hold a conversation
  thread, and track an opportunity; existing `contactMessages` inbox is unaffected.
- **Reuses**: `adminMutationRateLimit`, `isTrustedMutation`, `readLimitedJson`, audit
  logging (`auditLogs` insert) on every mutation, exactly as `admin/avs/route.ts` does
  today.

## Phase 4 — Admission (appointment/assessment)

- **Goal**: appointment types/slots/appointments, assessment attempts, feeding the
  admission funnel toward `account_invitation`.
- **Tables**: `appointmentType`, `appointmentSlot`, `appointment`, `assessmentAttempt`
  (`DATA_MODEL.md` §6).
- **APIs**: public `POST /api/admission/appointments` (book a slot, rate-limited,
  bounded body, no auth required since the actor is a pre-account contact), admin
  `admin/admission/*` management, `admin/admission/assessments/[id]/result`.
- **UI**: public booking widget (FR/AR), admin slot management and assessment result
  entry.
- **Migrations**: four new tables.
- **Security requirements**: slot booking is capacity-checked transactionally (row lock,
  `DATA_MODEL.md` constraint #5); public booking route needs the same rate-limit
  discipline as `contact`/`newsletter` routes today; assessment results are staff-
  entered only, never client-submitted as a final score without a staff review step for
  automated assessments (if any).
- **Tests**: integration test for concurrent booking of the last slot (only one of two
  simultaneous requests should succeed) — a genuine concurrency regression test, not a
  source-text assertion.
- **Dependencies**: Phase 3 (`contact`).
- **Rollback**: drop the four tables; `contact` unaffected.
- **Definition of Done**: a contact can book a slot, get marked `COMPLETED`, receive an
  assessment result; capacity never oversold under concurrent load (tested).
- **Reuses**: `contact.ts` newsletter/contact route rate-limit pattern; DB-transaction
  pattern from `checkout-service.ts`'s order creation for the row-lock booking flow.

## Phase 5 — WhatsApp (core integration)

- **Goal**: Meta Cloud API webhook intake, outgoing message sending, templates,
  delivery/read status.
- **Tables**: `whatsappAccount`, `whatsappWebhookEvent`, `whatsappMessage`,
  `whatsappTemplate` (`DATA_MODEL.md` §7).
- **APIs**: `POST /api/webhooks/whatsapp` (Meta webhook, signature-verified, idempotent
  on `metaMessageId`), `POST /api/admin/whatsapp/send` (staff-initiated send, template
  or session message).
- **UI**: admin conversation inbox surfaces WhatsApp messages (extends Phase 3's
  conversation UI with a WhatsApp-specific message renderer).
- **Migrations**: four new tables.
- **Security requirements**: webhook signature verification (Meta's `X-Hub-Signature-
  256`) is mandatory before any payload is trusted — same "verify server-to-server,
  never trust the payload's own claims" discipline as `flouci.ts`'s
  `authorization()` check; idempotent processing keyed on `metaMessageId`.
- **Tests**: integration test suite modeled directly on
  `tests/integration/flouci-webhook.test.ts` — signature-invalid rejection, replayed-
  webhook idempotency (same event processed twice → one `whatsappMessage`/status
  update), and out-of-order delivery/read status updates handled correctly.
- **Dependencies**: Phase 3 (`conversation`).
- **Rollback**: drop the four tables and the webhook route; no existing table touched.
- **Definition of Done**: inbound messages create/append to a `conversation`; outbound
  sends update `whatsappMessage.status` on delivery/read webhooks; replayed webhooks are
  provably idempotent (test-covered, not just asserted).
- **Reuses**: `flouci.ts` webhook signature-verification pattern; `JobQueue` (§11 of
  `ARCHITECTURE.md`) for outbound sends so a Meta API timeout doesn't block the
  triggering request.

## Phase 6 — WhatsApp verification (OTP, opt-in)

- **Goal**: phone/account verification via WhatsApp OTP; opt-in/opt-out tracking for
  template sends.
- **Tables**: `whatsappOptIn` (`DATA_MODEL.md` §7); OTP codes stored hashed, reusing the
  `verification` table's identifier/value/expiresAt shape (new `identifier` prefix,
  e.g. `whatsapp-otp:<contactId>`, rather than a new table).
- **APIs**: `POST /api/admission/verify/whatsapp/request`, `POST /api/admission/verify/
  whatsapp/confirm` (rate-limited, bounded attempts).
- **UI**: verification step in the admission funnel's account-creation flow.
- **Migrations**: `whatsappOptIn` table; no change to `verification`'s schema, only new
  row `identifier` conventions.
- **Security requirements**: OTP codes are never logged (payload/message bodies must be
  redacted in any WhatsApp send/receive logging, per `CLAUDE.md`'s "never log tokens/
  OTPs/signed URLs"); bounded verification attempts (rate-limited per contact/phone,
  same shape as `consumeRateLimit` on sign-in); OTP hashed at rest, compared via
  constant-time comparison (mirrors Better Auth's own credential handling).
- **Tests**: integration test for OTP expiry, wrong-code rejection with attempt
  limiting, and opt-out honoring (a template send attempt to an opted-out number/contact
  must be rejected before any Meta API call).
- **Dependencies**: Phase 4 (admission), Phase 5 (WhatsApp core).
- **Rollback**: drop `whatsappOptIn`; OTP `verification` rows expire naturally, no
  schema rollback needed for those.
- **Definition of Done**: a contact can verify their WhatsApp number as the terminal
  step before account creation; opt-out is honored for every subsequent template send.
- **Reuses**: `verification` table and its TTL semantics; `consumeRateLimit()`.

## Phase 7 — LMS / cohorts / enrollment sources

- **Goal**: cohorts, teacher assignment, enrollment source tracking, tying the
  admission funnel's PASS outcome to real enrollment.
- **Tables**: `cohort`, `cohortMembership`, `relationship` (`TEACHER_OF_COURSE` +
  `*_OF_STUDENT` types), `enrollments.source` column (`DATA_MODEL.md` §3, §4, §8).
- **APIs**: `admin/cohorts` CRUD, `admin/relationships` CRUD (grant/revoke parent/AVS/
  specialist links), `POST /api/admission/enroll` (funnel terminal step, sets
  `enrollments.source`).
- **UI**: admin cohort roster management; teacher portal roster view (Phase 11 wires
  the portal route itself, this phase only needs the underlying query to exist).
- **Migrations**: three new tables + one additive column with a default.
- **Security requirements**: relationship creation is admin/org-manager only, never
  self-service (`DATA_MODEL.md` §3's IDOR note); teacher roster queries scoped by
  `relationship.subjectUserId = self`.
- **Tests**: integration test that a `TEST_PASS`-sourced enrollment grants identical
  media/entitlement access as a `PAYMENT`-sourced one (regression-proves §9 of
  `ARCHITECTURE.md`'s claim that `source` doesn't fork the entitlement path) — reuses
  the exact assertions from `tests/integration/storage-authorization.test.ts` against a
  `TEST_PASS` enrollment fixture instead of a purchase fixture.
- **Dependencies**: Phase 1 (personas, for TEACHER-scoped queries), Phase 4 (admission,
  for the PASS→enroll trigger).
- **Rollback**: drop three tables; `enrollments.source` column drop (safe, additive-only
  column with a default, no data dependent on it existing yet at rollback time).
- **Definition of Done**: an assessment PASS can enroll a student with
  `source=TEST_PASS`; that student has identical course/media access as a paying
  student (test-proven); a teacher relationship scopes cohort roster visibility.
- **Reuses**: entire existing entitlement/storage-authorization stack, unmodified —
  this phase is the strongest test of "did we actually keep it additive."

## Phase 8 — Video (media provider abstraction)

- **Goal**: Cloudflare Stream for protected paid video, alongside existing S3-compatible
  storage for documents/resources; YouTube for public/preview.
- **Tables**: `lessons.mediaProvider`/`mediaRef` columns (`DATA_MODEL.md` §8).
- **APIs**: `resolveLessonMedia(lesson, userId)` service function
  (`ARCHITECTURE.md` §10); admin lesson form gains a provider selector.
- **UI**: course player branches on provider (YouTube embed / Cloudflare Stream player /
  existing signed-URL `<video>`); admin lesson editor UI.
- **Migrations**: two additive columns with defaults.
- **Security requirements**: entitlement check (`getLearningCourse`) must run **before**
  a Cloudflare Stream signed token is requested, identical ordering to the existing
  `signedMediaUrl()` call it sits beside — this is the phase most directly bound by this
  session's storage-authorization audit findings; the new branch must be proven, not
  assumed, to preserve entitlement-before-signing.
- **Tests**: unit test (source-inspection style, matching
  `storage-route-contracts.test.ts`) proving the Cloudflare Stream token request occurs
  after the entitlement check in `resolveLessonMedia`; integration test that a non-
  enrolled user gets no Cloudflare Stream token for a protected lesson.
- **Dependencies**: none beyond existing LMS (independent of CRM/WhatsApp phases).
- **Rollback**: `mediaProvider` defaults to `'internal'`; dropping the columns reverts
  every lesson to the current signed-URL path with no data loss.
- **Definition of Done**: a protected lesson can use Cloudflare Stream with entitlement
  enforced and test-proven; a preview lesson can use YouTube; existing `internal`
  lessons unaffected.
- **Reuses**: `signedMediaUrl()`'s entitlement-before-signing pattern; `getLearningCourse()`
  as the single resolution point.

## Phase 9 — Events / automation (outbox + worker)

- **Goal**: transactional outbox, worker process consuming `JobQueue`, CRM automation
  triggers (e.g., "assessment passed → send WhatsApp template").
- **Tables**: `outboxEvent` (`DATA_MODEL.md` §9).
- **APIs**: none public; internal worker entrypoint (`scripts/worker.ts` or similar,
  mirroring `scripts/seed.ts`'s standalone-script convention).
- **UI**: admin "automation rules" screen (optional, can be config-only for v1 — see
  Ponytail note below).
- **Migrations**: one new table.
- **Security requirements**: worker runs with its own service-level DB credentials, no
  user session context — every job handler re-validates the data it acts on (e.g., a
  `whatsapp.send` handler still checks `whatsappOptIn` before sending, never trusting
  that the enqueuing code already checked, since jobs can be retried against changed
  state).
- **Tests**: integration test for `SELECT ... FOR UPDATE SKIP LOCKED` correctness under
  two concurrent worker instances (no event double-processed); idempotency test
  (redelivering the same `idempotencyKey` to `JobQueue.enqueue()` is a no-op per the
  existing contract's stated guarantee).
- **Dependencies**: Phases 5/6 (WhatsApp sends are the first real consumer), though the
  outbox table itself has no FK dependency and could land earlier if useful.
- **Rollback**: drop `outboxEvent`; stop the worker process; no synchronous code path
  depends on it (everything that writes to it also completes its own transaction
  first).
- **Definition of Done**: an assessment PASS event reliably triggers exactly one
  WhatsApp send, proven under simulated worker crash/retry.
- **Reuses**: `src/server/queue/contracts.ts` (`JobQueue`/`JobHandler`/`JobName`)
  unchanged as the dispatch boundary — this phase does not invent a second event system.

## Phase 10 — AI

- **Goal**: implement the existing `src/server/ai/contracts.ts` interfaces: an
  `LLMProvider`, `EmbeddingProvider`+pgvector `Retriever`, `ConversationRepository`,
  `ToolRegistry` with a small allowlisted tool set, `AIUsageMeter`.
- **Tables**: `aiAgent`, `knowledgeSource`, `knowledgeChunk`, `aiConversation`,
  `aiMessage`, `aiUsageLog` (`DATA_MODEL.md` §10).
- **APIs**: `POST /api/ai/chat` (feature-flagged, disabled by default per
  `AI_ARCHITECTURE.md`), `POST /api/admin/ai/knowledge-sources` (ingestion trigger,
  enqueues the existing `ai.ingest` job name).
- **UI**: minimal chat widget, feature-flagged off in production until reviewed.
- **Migrations**: six new tables (`knowledgeChunk` requires the `pgvector` extension —
  evaluate before a separate vector database, per `AI_ARCHITECTURE.md`).
- **Security requirements**: retrieval filters by entitlement before any chunk reaches
  the model (`ARCHITECTURE.md` §12); every `AiTool` re-authorizes independently of the
  model's request; `AIUsageMeter.assertWithinQuota` enforced before every LLM call;
  prompts/responses/tool payloads must not be logged verbatim if they could contain
  PII — structured, redacted logging only.
- **Tests**: integration test proving a `Retriever` never returns a chunk sourced from a
  course the querying user isn't enrolled in (direct analog to this session's resource-
  entitlement IDOR tests); unit test that every registered `AiTool.execute` performs its
  own authorization check independent of `AiToolContext.userId` being "trusted."
- **Dependencies**: none beyond existing course/resource entitlement tables — can ship
  independently of CRM/WhatsApp, though it's more useful after them (e.g., an
  AI-drafted WhatsApp reply tool).
- **Rollback**: feature flag off; drop the six tables; nothing else depends on them.
- **Definition of Done**: AI chat works end-to-end behind a flag with entitlement-
  filtered retrieval and self-authorizing tools, both regression-tested; disabled by
  default in production, matching `AI_ARCHITECTURE.md`'s current stance.
- **Reuses**: all five interfaces in `src/server/ai/contracts.ts` verbatim; `ai.ingest`
  `JobName` (already defined); `JobQueue` from Phase 9.

## Phase 11 — Portals

- **Goal**: independent per-persona portal route groups.
- **Tables**: none (routing/composition layer).
- **APIs**: none new beyond what earlier phases already exposed; portals compose
  existing query functions.
- **UI**: `/[locale]/portal/teacher`, `/avs`, `/parent`, `/specialist`,
  `/organization/[orgId]` route groups (`PERSONA_CAPABILITY_MATRIX.md`'s portal table).
- **Migrations**: none.
- **Security requirements**: `requirePersona()`/`requireOrgMembership()` guard at the
  top of every portal layout, mirroring `admin/layout.tsx`'s existing
  `getAdminSession()` gate — unauthenticated/wrong-persona requests never reach a
  page component that could leak navigation structure.
- **Tests**: E2E test per portal (extends `tests/e2e/`) asserting a user without the
  relevant persona gets redirected/403'd, not just a hidden nav item.
- **Dependencies**: Phases 1 (personas), 2 (organizations), 7 (cohorts/relationships)
  for the data each portal displays.
- **Rollback**: remove route groups; no data impact.
- **Definition of Done**: each persona has a working portal showing only its own scoped
  data; cross-persona access denied server-side, not just hidden client-side.
- **Reuses**: `getDashboardData`/`getLearningCourse` and this roadmap's earlier phases'
  query functions; `admin/layout.tsx`'s session-gate-at-layout pattern.

## Phase 12 — Advanced CRM

- **Goal**: automation rules (trigger → action), broadcast sends with template
  approval-status checks, richer pipeline reporting.
- **Tables**: none new required beyond an `automationRule` table if config-driven
  automation is chosen (`id, triggerEventType, action, conditions jsonb, enabled`) —
  ponytail: keep this config-only and simple until real usage patterns emerge; don't
  build a generic rule engine speculatively.
- **APIs**: `admin/crm/automations`, `admin/crm/broadcasts`.
- **UI**: automation builder, broadcast composer with template picker (only
  `whatsappTemplate.approvalStatus = 'approved'` selectable).
- **Migrations**: one new table (`automationRule`), optional.
- **Security requirements**: broadcast sends are rate-limited per organization/day to
  avoid runaway costs and Meta policy violations; automation actions go through the
  same `outboxEvent`→`JobQueue` path as any other side effect, never a direct synchronous
  Meta API call from an admin request handler.
- **Tests**: integration test that only approved templates are sendable via broadcast;
  rate-limit test on broadcast volume.
- **Dependencies**: Phases 3, 5, 9.
- **Rollback**: drop `automationRule`; disable broadcast UI; core CRM/WhatsApp unaffected.
- **Definition of Done**: staff can configure a simple trigger→WhatsApp-template
  automation and send a rate-limited broadcast to an opted-in segment.
- **Reuses**: Phase 9's outbox/worker path; Phase 6's opt-in enforcement.

## Phase 13 — Analytics

- **Goal**: cross-domain reporting (funnel conversion, cohort completion, organization
  usage) without adding a new analytics database.
- **Tables**: none new — materialized views or scheduled aggregate queries over
  existing tables (`contact`, `appointment`, `assessmentAttempt`, `enrollments`,
  `cohortMembership`).
- **APIs**: `admin/analytics/*` read-only endpoints.
- **UI**: admin analytics dashboards.
- **Migrations**: optional materialized views (`CREATE MATERIALIZED VIEW`, refreshed on
  a schedule via the worker from Phase 9).
- **Security requirements**: every analytics query is organization-scoped identically to
  the underlying tables it aggregates — no aggregate route may accept an unscoped
  "all organizations" query for a non-`SUPER_ADMIN` caller.
- **Tests**: integration test for organization-scoped aggregate correctness (org A's
  numbers never include org B's rows).
- **Dependencies**: Phases 2, 3, 4, 7 (the domains being aggregated).
- **Rollback**: drop materialized views/routes; no impact on underlying data.
- **Definition of Done**: admin/org-manager dashboards show accurate, scope-correct
  funnel/cohort/organization metrics.
- **Reuses**: existing `admin` query/route conventions; no new data-access pattern.

## Phase 14 — Production scaling

- **Goal**: harden the worker deployment, WhatsApp/Cloudflare/LLM provider credentials
  and rate limits, and confirm the scaling path in `DEPLOYMENT_SCALING.md` under real
  load.
- **Tables**: none.
- **APIs**: none new; this phase is operational.
- **UI**: none.
- **Migrations**: none (indexes only, if load testing surfaces a missing one — same
  discipline as `0002_query_indexes.sql`'s precedent).
- **Security requirements**: production env validation (`src/server/env.ts`) extended to
  require WhatsApp/Cloudflare Stream/LLM credentials be fully configured before those
  features can run in production — same "production mode guards" pattern already
  enforced for S3-compatible storage.
- **Tests**: load/soak test on the worker's `SELECT ... FOR UPDATE SKIP LOCKED` polling
  loop; webhook burst test for WhatsApp.
- **Dependencies**: all prior phases.
- **Rollback**: n/a (operational hardening, not a feature toggle).
- **Definition of Done**: `npm run check` full gate green; load-tested worker; env
  validation rejects incomplete production config for every new external integration,
  exactly as it already does for storage.
- **Reuses**: `src/server/env.ts`'s existing production-mode validation pattern,
  extended per-integration.

---

## Cross-phase invariants (apply to every phase above)

- No phase weakens `isTrustedMutation`, session freshness (`getFreshSession`), rate
  limiting, Zod validation, or audit logging on any new mutation route.
- No phase stores money as anything but integer millimes.
- No phase's UI ships without FR/AR copy and RTL-correct layout.
- No phase's AI/automation path is permitted to perform a mutating action without
  re-running the same authorization check a human-triggered equivalent route would run.
- Every new webhook/external-integration route re-verifies state server-to-server; a
  browser redirect or webhook payload's own claims are never trusted as proof, matching
  the existing payment-verification invariant.
