# ANEI Premium Platform — Target Architecture (Phase 0)

Status: **planning document only**. Nothing in this file has been implemented, migrated,
or committed to schema. It extends `docs/ARCHITECTURE.md` (still authoritative for what
exists today) rather than replacing it. Where the two disagree, the current source code
wins — this document describes where we are going, not what is live.

## 1. Why this document exists

ANEI is evolving from a course-catalog LMS into a persona-driven education + CRM +
WhatsApp + AI platform, while staying:

- one PostgreSQL database, one Drizzle schema, one Better Auth identity system;
- a modular monolith (no microservices, no Kubernetes);
- built on the security invariants already enforced today (origin/CSRF checks, fresh
  admin sessions, entitlement-before-signing storage, server-side payment verification,
  integer millimes, FR/AR localization).

`ArnasDon/wacrm` was reviewed for **architectural shape only** (contacts/tags/pipeline,
shared inbox, WhatsApp broadcast + templates + delivery/read tracking, automation
triggers, AI reply drafting over a retrieval-filtered knowledge base). Its Supabase
coupling (Supabase Auth, Row-Level Security, Supabase Storage, Supabase Realtime, the
`supabase/` migration folder) is explicitly **not** carried over — ANEI already has
equivalents (Better Auth, application-layer authorization identical to the pattern in
`src/server/auth/admin.ts` and `src/modules/admin/domain/permissions.ts`, private
S3-compatible storage, and polling/SWR-based dashboards). RLS is not adopted: ANEI's
existing convention is to authorize in the query/service layer (see every `get*For*`
helper in `src/server/queries/`), and that convention is preserved and extended, not
replaced, for every new domain below.

## 2. Personas vs. security roles — the central distinction

`user.role` (`USER` / `ADMIN` / `SUPER_ADMIN`) is a **security role**. It governs
platform administration and never changes. It must not be overloaded to express what a
person *does* on ANEI.

`user.profileType` (today: `learner | teacher | avs | parent | specialist |
institution`) is the closest existing concept to a "persona," but it is a single
column chosen once at signup (`AuthForm.tsx` → `authClient.signUp.email({ profileType,
... })` → `enforceNewUserDefaults()` in `src/server/auth/policy.ts`). It cannot express
a person who is both a parent *and* a teacher, and it has no capability semantics of its
own — it's descriptive, not authorizing.

The target model introduces a **persona** as a first-class, per-user, many-per-user
concept:

```text
user (Better Auth identity, security role)
 └─ persona_membership (1..N per user, exactly one primary)
     └─ persona: TEACHER | AVS | PARENT | SPECIALIST | ORGANIZATION | STUDENT
```

Rules that must hold:
- `user.role` continues to gate `/admin/*` and privileged mutation routes exactly as
  today — no roadmap phase touches this.
- A persona is never sufficient to authorize an admin action, and `user.role` is never
  sufficient to authorize a persona-scoped action (e.g., being `ADMIN` does not make you
  a course's assigned `TEACHER`; that is a separate relationship, see §4).
- `user.profileType` is kept (migration, not deletion — it feeds analytics/existing
  admin filters) and is reinterpreted as "primary persona at signup," backed by a
  `persona_membership` row created transactionally alongside it. Existing rows migrate
  1:1 (`learner→STUDENT`, `teacher→TEACHER`, `avs→AVS`, `parent→PARENT`,
  `specialist→SPECIALIST`, `institution→ORGANIZATION`).
- Persona capability checks live in a single module (`src/modules/personas/domain/
  permissions.ts`, mirroring `modules/admin/domain/permissions.ts`) so authorization
  logic is not duplicated per route.

See `PERSONA_CAPABILITY_MATRIX.md` for the full capability table and
`DATA_MODEL.md` §1 for the exact table shape.

## 3. Organizations

Organizations are ANEI's multi-tenant boundary for institutional customers (schools,
associations, NGOs) — distinct from `profileType: institution`, which only describes an
individual user's persona. An organization is a tenant; users join it via membership
rows with **organization-scoped roles**, independent of `user.role`:

```text
organization
 └─ organization_membership (user_id, organization_id, role)
      role: OWNER | MANAGER | STAFF | VIEWER
```

- `OWNER`/`MANAGER` can invite/manage members, manage the organization's cohorts and
  CRM contacts, and view organization-scoped billing/enrollment analytics.
- `STAFF` operates day-to-day CRM/cohort work without membership management.
- `VIEWER` is read-only (e.g., an auditor or a funding partner).
- Cross-organization access is denied by default: every organization-scoped query is
  parameterized by `organization_id` derived from the caller's own membership row, never
  from a client-supplied `organizationId` (same pattern as
  `getPurchasedResourceForDownload(session.user.id, ...)` today — the caller's identity
  drives the WHERE clause, not request input).
- A user can hold memberships in multiple organizations; there is no implicit "current
  organization" in the session — every organization-scoped route requires an explicit,
  membership-checked `organizationId` path/body parameter.

## 4. Relationships (parent–student, AVS–student, specialist–student, teacher–course)

Relationships are typed edges between two personas, always explicit rows (never
inferred from role/persona alone):

```text
relationship(id, type, subject_user_id, object_user_id | object_course_id,
             organization_id nullable, status, created_by, created_at)
type: PARENT_OF_STUDENT | AVS_OF_STUDENT | SPECIALIST_OF_STUDENT | TEACHER_OF_COURSE
```

- `TEACHER_OF_COURSE` replaces the current `courses.trainerName` free-text field with an
  auditable, queryable assignment (`trainerName` is kept for display/legacy data; new
  courses populate the relationship and can leave `trainerName` derived).
- Person-to-student relationships (`PARENT_OF_STUDENT`, `AVS_OF_STUDENT`,
  `SPECIALIST_OF_STUDENT`) must be created by an admin/organization manager, not
  self-declared by either party — this is the primary IDOR surface for this feature
  area (see `SECURITY_MODEL.md` §2) and requires a `status` (`PENDING`/`ACTIVE`/
  `REVOKED`) so a parent cannot claim an arbitrary student by guessing an ID.
- A relationship grants **read** access to the object student's progress/attendance
  summary only, never to payment, private messages, or unrelated students — enforced by
  a `requireRelationship(actorUserId, studentUserId, type)` query helper used the same
  way `getLearningCourse(userId, slug)` scopes learning data today.

## 5. Cohorts

A cohort groups students within a course (or organization) for a shared schedule/
teacher, without replacing the existing per-user `enrollments` table:

```text
cohort(id, course_id, organization_id nullable, name, starts_at, ends_at, capacity)
cohort_membership(cohort_id, user_id, enrollment_id)
```

`cohort_membership.enrollment_id` references the existing `enrollments` row — a cohort
is an organizational grouping over enrollments, not a parallel enrollment system.
Capacity and schedule are cohort-level; progress/completion stay on `enrollments` /
`lessonProgress` exactly as today.

## 6. CRM

CRM contacts are **pre-account leads**, deliberately modeled separately from `user`:

```text
contact(id, organization_id nullable, first_name, last_name, email, phone,
        locale, source, converted_user_id nullable, created_at)
contact_tag(contact_id, tag)
contact_note(id, contact_id, author_user_id, body, created_at)
conversation(id, contact_id nullable, user_id nullable, channel, status, assigned_to)
message(id, conversation_id, direction, channel, body, external_id, sent_at)
opportunity(id, contact_id, pipeline_stage, course_id nullable, amount_millimes, status)
```

- A `contact` becomes a `user` exactly once, recorded via `converted_user_id` — this is
  the join point between "lead" and "learner." Nothing in the LMS/commerce domain ever
  references `contact` directly; once converted, all further activity is on `user`.
  This mirrors wacrm's contact/lead model but replaces its Supabase RLS-per-tenant
  isolation with the same explicit `organization_id`-scoped query pattern used
  elsewhere in ANEI.
- `conversation`/`message` are channel-agnostic (WhatsApp today; email/SMS later) — see
  §7 for the WhatsApp-specific tables that `message.external_id` and `channel` join
  against.
- `opportunity` reuses `amount_millimes` (integer millimes, matching `orders`/
  `payments`) rather than inventing a new money representation.

## 7. Admission funnel

Lead → appointment → assessment → PASS → invitation → account → WhatsApp verification →
enrollment:

```text
appointment_type(id, name, duration_minutes)
appointment_slot(id, appointment_type_id, starts_at, capacity, staff_user_id)
appointment(id, slot_id, contact_id, status)              -- BOOKED|COMPLETED|NO_SHOW|CANCELLED
assessment_attempt(id, contact_id, appointment_id nullable, score, result)  -- PASS|FAIL
account_invitation(id, contact_id, token_hash, expires_at, consumed_at, created_by)
```

- `account_invitation` follows Better Auth's own verification-token convention
  (`verification` table: identifier/value/expiresAt) — store only a hash of the token,
  never the raw token, and reuse `verification`-style TTL handling rather than
  inventing a new one.
- Consuming an invitation creates the `user` row (transactionally) and sets
  `contact.converted_user_id`; a consumed or expired invitation can never be reused
  (single-use, enforced at the DB level via `consumed_at IS NULL` in the update's WHERE
  clause, not just application logic — same defense-in-depth pattern as
  `orders_user_idempotency_unique`).
- Enrollment sources (§9) record `ADMIN`/`ORGANIZATION` enrollment as the terminal step
  of this funnel, alongside the existing `PAYMENT` path.

## 8. WhatsApp (Meta Cloud API)

```text
whatsapp_account(id, phone_number_id, display_phone_number, waba_id)
whatsapp_webhook_event(id, meta_message_id UNIQUE, payload jsonb, processed_at, status)
whatsapp_message(id, conversation_id, direction, whatsapp_message_id UNIQUE,
                  template_name nullable, status, sent_at)
whatsapp_template(id, name, language, category, approval_status)
whatsapp_opt_in(user_id | contact_id, phone, opted_in_at, opted_out_at)
```

- `meta_message_id`/`whatsapp_message_id` uniqueness is the idempotency boundary for
  Meta's at-least-once webhook delivery — reusing the exact pattern already proven in
  `payments_provider_external_unique` for Flouci. A webhook handler upserts on this key
  and never double-processes a delivery/read status update.
  The existing `tests/integration/flouci-webhook.test.ts` conventions (real-Postgres
  idempotency test, signature verification test) are the template for the WhatsApp
  webhook's test suite.
- OTP verification (used for account/phone verification, §7) sends a one-time template
  message and stores only a hash of the code, mirroring Better Auth's password/token
  hashing discipline — never log the OTP or the outbound message body (see
  `SECURITY_MODEL.md` §5).
- Outbound sends and inbound webhook processing both go through the outbox/queue
  boundary in §10, not synchronous calls inside a request handler — a Meta API timeout
  must not block or fail an unrelated user-facing request.

## 9. LMS evolution

Additive to the existing hierarchy in `docs/ARCHITECTURE.md` (`Course → Module →
Lesson`, `User → Enrollment → LessonProgress → Certificate`):

- `cohort`/`cohort_membership` (§5) and `relationship: TEACHER_OF_COURSE` (§4) are the
  only new joins; `courses`, `courseModules`, `lessons`, `enrollments`,
  `lessonProgress`, `certificates` keep their current shape and constraints unchanged.
- `enrollments.source` (new column, default `PAYMENT` for backward compatibility):
  `PAYMENT | TEST_PASS | ORGANIZATION | ADMIN | MANUAL`. This lets the admission funnel
  (§7) and organization bulk-enrollment create entitlement without inventing a parallel
  entitlement table — a `TEST_PASS` enrollment is still just an `enrollments` row, so
  every existing progress/completion/certificate/media-authorization code path (the one
  just audited and hardened in the storage-authorization work) applies unchanged.
- Lesson media gains a **provider** field (§10) but `lessons.videoUrl`/`documentUrl`
  keep meaning "the private object key or provider reference to resolve," preserving
  the existing `getLearningCourse()` resolution point as the single place lesson media
  URLs are signed/resolved.

## 10. Media provider abstraction

```text
lessons.media_provider: 'internal' | 'youtube' | 'cloudflare_stream'   (new column)
```

- `internal` (today's default): existing private S3-compatible storage,
  `signedMediaUrl()` — unchanged, this remains the only path for protected documents/
  resources. This audit's findings (entitlement always precedes signing, object keys
  always come from DB rows) are the invariant every new provider branch must preserve.
- `youtube`: public/preview lessons only (`lessons.preview = true`), embed by video ID,
  no signing needed — never used for paid/protected content.
- `cloudflare_stream`: protected paid video. ANEI requests a signed Cloudflare Stream
  playback token server-side (same entitlement-then-sign shape as
  `signedMediaUrl()`), after the identical enrollment/entitlement check
  `getLearningCourse()` already performs. Cloudflare Stream's own signed-URL/token
  expiry replaces self-hosted HLS transcoding (`docs/MEDIA.md`'s "future high-volume
  pipeline" future work) — this is why Cloudflare Stream was chosen over building
  transcoding in-house.
- A single `resolveLessonMedia(lesson, userId)` function dispatches on
  `media_provider`, keeping every call site (course player, admin preview) provider-
  agnostic — this is the one new abstraction introduced in this whole blueprint that
  isn't a direct 1:1 reuse, and it's justified because three call sites already need to
  branch on provider and would otherwise duplicate the entitlement-then-resolve
  sequence three times.

## 11. Events / transactional outbox

ANEI already defines a job boundary: `src/server/queue/contracts.ts`
(`JobQueue`/`JobHandler`/`JobEnvelope<T>` with `idempotencyKey`, and a `JobName` union
that already includes `notification.send`, `media.process`, `payment.reconcile`, and
`ai.ingest`). The premium platform **reuses this contract as the outbox's dispatch
boundary** rather than inventing a second event system:

```text
outbox_event(id, aggregate_type, aggregate_id, event_type, payload jsonb,
             idempotency_key UNIQUE, status, created_at, processed_at)
```

- Domain writes (e.g., "assessment passed," "WhatsApp message received," "enrollment
  created") insert an `outbox_event` row in the **same transaction** as the domain
  state change — the classic transactional-outbox pattern, chosen specifically so a
  crash between "state changed" and "side effect dispatched" cannot happen (a real risk
  for WhatsApp sends and AI ingestion triggers, both external calls).
- A worker polls `outbox_event` and calls `JobQueue.enqueue()` with
  `idempotencyKey = outbox_event.idempotency_key`, extending `JobName` with
  `whatsapp.send`, `whatsapp.webhook.process`, `crm.automation.run`,
  `assessment.evaluate`. No new job-boundary abstraction is created — only new
  `JobName` members and handlers.
- `JobQueue`'s concrete implementation (a "mature Redis-backed worker," per the
  contract's own comment) is a Phase 9/14 decision, not a Phase 0 one — see
  `ROADMAP.md` and `DEPLOYMENT_SCALING.md`.

## 12. AI subsystem

`src/server/ai/contracts.ts` already defines the exact provider-neutral boundary this
blueprint needs: `LLMProvider`, `EmbeddingProvider`, `Retriever` (whose interface
comment already states "implementations MUST apply user entitlement filters before
returning private chunks"), `ConversationRepository`, `ToolRegistry` (already commented
"the registry is an allowlist; every tool must authorize independently of the LLM"),
and `AIUsageMeter`. `docs/AI_ARCHITECTURE.md` already specifies the exact request path
this blueprint reuses verbatim:

```text
user → auth/quota → authorized retrieval filter → LLM gateway
                                      └→ tool registry; every tool re-authorizes
```

No new AI contract is introduced. The premium platform's job is to **implement** these
existing interfaces, plus add the storage they imply:

```text
ai_agent(id, name, persona_scope, system_prompt, enabled)
knowledge_source(id, type, ref, organization_id nullable)
knowledge_chunk(id, source_id, text, embedding vector(N), course_id nullable,
                resource_id nullable)          -- pgvector, per AI_ARCHITECTURE.md §"Evaluate
                                                --   PostgreSQL + pgvector before a separate
                                                --   vector database"
ai_conversation(id, user_id, agent_id, created_at)   -- backs ConversationRepository
ai_message(id, conversation_id, role, content, created_at)
ai_usage_log(id, user_id, provider, input_tokens, output_tokens, duration_ms, success, created_at)
                                                       -- backs AIUsageMeter.record()
```

- `Retriever` implementations filter `knowledge_chunk` by the same entitlement checks
  already used elsewhere (a chunk sourced from a paid course's private resource is only
  retrievable for an enrolled user — reusing `getLearningCourse`/
  `getPurchasedResourceForDownload`-style scoping, not a new authorization mechanism).
- Tools (`AiTool`) are the only way an agent can take action (e.g., "look up my
  enrollment status," "draft a WhatsApp reply for staff review"). Per the existing
  contract's own doc comment and `AI_ARCHITECTURE.md`: **the model never decides
  authorization** — every tool re-checks the caller's real permission before acting,
  exactly like every other mutation route in ANEI. An AI tool must never be able to
  enroll, refund, change a role, or send a WhatsApp message without going through the
  same authorization + rate-limit + audit path a human-triggered route would use.
- `ai.ingest` (already a `JobName`) is the job that chunks/embeds a `knowledge_source`
  asynchronously — reused from §11, not reinvented.

## 13. Portals

Each persona gets an independent portal route group (e.g., `/[locale]/portal/teacher`,
`/[locale]/portal/parent`, `/[locale]/portal/organization/[orgId]`), not one dashboard
with conditionally-hidden links. Rationale: the current `dashboard/page.tsx` is a
single learner-shaped view; grafting five more personas' navigation onto it as
hidden/shown links would (a) leak the existence of features a persona can't use in the
client bundle/DOM even if visually hidden, and (b) make the authorization surface
harder to audit than one route group per persona with its own `requirePersona()` guard
at the top, mirroring how `admin/*` routes already gate on `getAdminSession()` before
rendering anything.

Each portal composes existing account/dashboard query functions
(`getDashboardData`, `getLearningCourse`, and their new persona-scoped siblings) rather
than duplicating query logic — the portal is a routing/composition layer, not a new
data-access layer.

## 14. Scale (summary — full detail in `DEPLOYMENT_SCALING.md`)

Still one modular-monolith Next.js deployment. New infrastructure dependencies:
a worker process (consuming `JobQueue`/outbox), Cloudflare Stream (video), Meta
WhatsApp Cloud API (messaging), and an LLM provider (AI, disabled by default exactly as
today until §12 is implemented and reviewed). No new database, no microservice split,
no Kubernetes — extending `docs/ARCHITECTURE.md`'s existing scaling path, not replacing
it.

## 15. Security (summary — full detail in `SECURITY_MODEL.md`)

Every new domain area in this document was designed against the same request-boundary
order already codified in `docs/ARCHITECTURE.md` §"Request boundaries" (origin check →
authenticate → authorize role/ownership/entitlement → rate-limit → bounded body →
Zod validation → service call → atomic commit → audit → normalized error). Nothing here
introduces a new authorization primitive; new tables are protected by the same
ownership/entitlement-scoped query pattern already proven for resources, courses, and
orders in this session's storage-authorization audit.

## Reused vs. new — quick index

| Area | Reused as-is | New |
|---|---|---|
| Identity | Better Auth `user`/`session`/`account` | `persona_membership` |
| Admin authorization | `getAdminSession`/`hasAdminPermission` pattern | mirrored for personas/orgs, not duplicated logic |
| Money | integer millimes convention | `opportunity.amount_millimes` |
| Idempotency | `orders_user_idempotency_unique`, `payments_provider_external_unique` pattern | `whatsapp_message.whatsapp_message_id`, `outbox_event.idempotency_key` |
| Jobs | `src/server/queue/contracts.ts` (`JobQueue`/`JobHandler`/`JobName`) | new `JobName` members, worker deployment |
| AI | `src/server/ai/contracts.ts` (all five interfaces) | concrete implementations + storage tables |
| Storage/media | `signedMediaUrl`/`signedDownloadUrl`/entitlement-before-signing | Cloudflare Stream branch, `media_provider` column |
| Verification/invitation TTL | `verification` table pattern (hash + expiry) | `account_invitation` |
| Webhook idempotency | Flouci webhook signature+idempotency pattern | WhatsApp webhook |
| Localization | FR/AR + RTL everywhere | unchanged, applies to all new UI |
