# Target Data Model (Phase 0 — planning only)

No migration exists yet. Tables below are described in Drizzle-shape pseudocode
matching the conventions already in `src/server/db/schema.ts` (`text("id").primaryKey()
.$defaultFn(id)`, `timestamp(...).notNull().$defaultFn(now)`, explicit `check(...)`
constraints, `uniqueIndex`/`index`, FK `onDelete` policy chosen per relationship). Column
types below are illustrative, not final SQL — the actual migration must be hand-checked
against Drizzle/Postgres conventions at implementation time, per `CLAUDE.md`'s
instruction to inspect existing schema/migration conventions before creating one.

## 1. Personas

```ts
personaMembership {
  id: text pk
  userId: text NOT NULL FK -> user.id ON DELETE CASCADE
  persona: text NOT NULL CHECK IN ('TEACHER','AVS','PARENT','SPECIALIST','ORGANIZATION','STUDENT')
  isPrimary: boolean NOT NULL DEFAULT false
  createdAt: timestamp
}
UNIQUE (userId, persona)
-- exactly one primary per user: enforced via partial unique index
UNIQUE (userId) WHERE isPrimary = true   -- Postgres partial unique index
```

Migration note: backfill one row per existing user from `user.profileType`
(`learner→STUDENT`, etc.), `isPrimary = true`, inside the same migration that adds the
table — never leave a window where a user has zero persona rows.

## 2. Organizations

```ts
organization {
  id: text pk
  name: text NOT NULL
  slug: text NOT NULL UNIQUE
  createdAt: timestamp
}

organizationMembership {
  id: text pk
  organizationId: text NOT NULL FK -> organization.id ON DELETE CASCADE
  userId: text NOT NULL FK -> user.id ON DELETE CASCADE
  role: text NOT NULL CHECK IN ('OWNER','MANAGER','STAFF','VIEWER')
  createdAt: timestamp
}
UNIQUE (organizationId, userId)
INDEX (userId)
```

## 3. Relationships

```ts
relationship {
  id: text pk
  type: text NOT NULL CHECK IN ('PARENT_OF_STUDENT','AVS_OF_STUDENT','SPECIALIST_OF_STUDENT','TEACHER_OF_COURSE')
  subjectUserId: text NOT NULL FK -> user.id ON DELETE CASCADE
  objectUserId: text FK -> user.id ON DELETE CASCADE           -- for *_OF_STUDENT types
  objectCourseId: text FK -> courses.id ON DELETE CASCADE      -- for TEACHER_OF_COURSE
  organizationId: text FK -> organization.id ON DELETE SET NULL
  status: text NOT NULL DEFAULT 'PENDING' CHECK IN ('PENDING','ACTIVE','REVOKED')
  createdBy: text NOT NULL FK -> user.id ON DELETE RESTRICT     -- admin/org manager, audited
  createdAt: timestamp
}
CHECK ( (type = 'TEACHER_OF_COURSE') = (objectCourseId IS NOT NULL) )
CHECK ( (type != 'TEACHER_OF_COURSE') = (objectUserId IS NOT NULL) )
INDEX (subjectUserId, type, status)
INDEX (objectUserId)
```

Every relationship creation route requires `getAdminSessionFor("relationships.manage")`
or an organization-manager-scoped equivalent — a subject can never create their own
relationship row (see `SECURITY_MODEL.md` §2).

## 4. Cohorts

```ts
cohort {
  id: text pk
  courseId: text NOT NULL FK -> courses.id ON DELETE CASCADE
  organizationId: text FK -> organization.id ON DELETE SET NULL
  name: text NOT NULL
  startsAt: timestamp
  endsAt: timestamp
  capacity: integer CHECK (capacity > 0)
  createdAt: timestamp
}

cohortMembership {
  id: text pk
  cohortId: text NOT NULL FK -> cohort.id ON DELETE CASCADE
  enrollmentId: text NOT NULL FK -> enrollments.id ON DELETE CASCADE
}
UNIQUE (cohortId, enrollmentId)
UNIQUE (enrollmentId)   -- one cohort per enrollment
```

## 5. CRM

```ts
contact {
  id: text pk
  organizationId: text FK -> organization.id ON DELETE SET NULL
  firstName: text NOT NULL
  lastName: text NOT NULL
  email: text
  phone: text
  locale: text NOT NULL DEFAULT 'fr' CHECK IN ('fr','ar')
  source: text NOT NULL DEFAULT 'manual'
  convertedUserId: text FK -> user.id ON DELETE SET NULL
  createdAt: timestamp
}
INDEX (organizationId)
INDEX (phone)     -- WhatsApp inbound matching
UNIQUE (convertedUserId)  -- a user is converted from at most one contact

contactTag {
  contactId: text NOT NULL FK -> contact.id ON DELETE CASCADE
  tag: text NOT NULL
}
UNIQUE (contactId, tag)

contactNote {
  id: text pk
  contactId: text NOT NULL FK -> contact.id ON DELETE CASCADE
  authorUserId: text NOT NULL FK -> user.id ON DELETE RESTRICT
  body: text NOT NULL
  createdAt: timestamp
}

conversation {
  id: text pk
  contactId: text FK -> contact.id ON DELETE SET NULL
  userId: text FK -> user.id ON DELETE SET NULL   -- set once contact converts
  channel: text NOT NULL CHECK IN ('whatsapp','email','in_app')
  status: text NOT NULL DEFAULT 'open' CHECK IN ('open','pending','closed')
  assignedTo: text FK -> user.id ON DELETE SET NULL
  createdAt: timestamp
}
CHECK (contactId IS NOT NULL OR userId IS NOT NULL)

message {
  id: text pk
  conversationId: text NOT NULL FK -> conversation.id ON DELETE CASCADE
  direction: text NOT NULL CHECK IN ('inbound','outbound')
  channel: text NOT NULL
  body: text NOT NULL
  externalId: text    -- joins whatsapp_message.whatsappMessageId when channel='whatsapp'
  sentAt: timestamp
}
INDEX (conversationId, sentAt)

opportunity {
  id: text pk
  contactId: text NOT NULL FK -> contact.id ON DELETE CASCADE
  pipelineStage: text NOT NULL CHECK IN ('lead','qualified','proposal','won','lost')
  courseId: text FK -> courses.id ON DELETE SET NULL
  amountMillimes: integer NOT NULL DEFAULT 0 CHECK (amountMillimes >= 0)
  status: text NOT NULL DEFAULT 'open' CHECK IN ('open','won','lost')
  createdAt: timestamp
}
```

## 6. Admission funnel

```ts
appointmentType { id: text pk, name: text NOT NULL, durationMinutes: integer NOT NULL CHECK (> 0) }

appointmentSlot {
  id: text pk
  appointmentTypeId: text NOT NULL FK -> appointmentType.id ON DELETE CASCADE
  startsAt: timestamp NOT NULL
  capacity: integer NOT NULL CHECK (> 0)
  staffUserId: text FK -> user.id ON DELETE SET NULL
}
INDEX (appointmentTypeId, startsAt)

appointment {
  id: text pk
  slotId: text NOT NULL FK -> appointmentSlot.id ON DELETE RESTRICT
  contactId: text NOT NULL FK -> contact.id ON DELETE CASCADE
  status: text NOT NULL DEFAULT 'BOOKED' CHECK IN ('BOOKED','COMPLETED','NO_SHOW','CANCELLED')
  createdAt: timestamp
}
-- capacity enforcement: booking count per slot checked transactionally against
-- appointmentSlot.capacity at insert time (SELECT ... FOR UPDATE on the slot row,
-- mirroring how order/payment writes are already done inside a DB transaction)

assessmentAttempt {
  id: text pk
  contactId: text NOT NULL FK -> contact.id ON DELETE CASCADE
  appointmentId: text FK -> appointment.id ON DELETE SET NULL
  score: integer
  result: text NOT NULL CHECK IN ('PENDING','PASS','FAIL')
  createdAt: timestamp
}

accountInvitation {
  id: text pk
  contactId: text NOT NULL FK -> contact.id ON DELETE CASCADE
  tokenHash: text NOT NULL UNIQUE       -- never store the raw token, mirrors `verification`
  expiresAt: timestamp NOT NULL
  consumedAt: timestamp
  createdBy: text NOT NULL FK -> user.id ON DELETE RESTRICT
  createdAt: timestamp
}
INDEX (contactId)
```

Consuming an invitation is one transaction: verify `tokenHash` + `expiresAt > now()` +
`consumedAt IS NULL`, create `user`, set `contact.convertedUserId`, set
`accountInvitation.consumedAt = now()` — the `UPDATE ... WHERE consumedAt IS NULL`
clause is the single-use guarantee, same defense-in-depth idea as
`orders_user_idempotency_unique`.

## 7. WhatsApp

```ts
whatsappAccount { id: text pk, phoneNumberId: text NOT NULL UNIQUE, displayPhoneNumber: text NOT NULL, wabaId: text NOT NULL }

whatsappWebhookEvent {
  id: text pk
  metaMessageId: text NOT NULL UNIQUE     -- idempotency boundary, mirrors payments_provider_external_unique
  payload: jsonb NOT NULL
  status: text NOT NULL DEFAULT 'pending' CHECK IN ('pending','processed','failed')
  processedAt: timestamp
  createdAt: timestamp
}

whatsappMessage {
  id: text pk
  conversationId: text NOT NULL FK -> conversation.id ON DELETE CASCADE
  direction: text NOT NULL CHECK IN ('inbound','outbound')
  whatsappMessageId: text NOT NULL UNIQUE
  templateName: text
  status: text NOT NULL DEFAULT 'queued' CHECK IN ('queued','sent','delivered','read','failed')
  sentAt: timestamp
}

whatsappTemplate {
  id: text pk
  name: text NOT NULL
  language: text NOT NULL
  category: text NOT NULL
  approvalStatus: text NOT NULL DEFAULT 'pending' CHECK IN ('pending','approved','rejected')
}
UNIQUE (name, language)

whatsappOptIn {
  id: text pk
  userId: text FK -> user.id ON DELETE CASCADE
  contactId: text FK -> contact.id ON DELETE CASCADE
  phone: text NOT NULL
  optedInAt: timestamp
  optedOutAt: timestamp
}
CHECK (userId IS NOT NULL OR contactId IS NOT NULL)
INDEX (phone)
```

Outbound *template* messages (marketing/re-engagement) require an active
`whatsappOptIn` row with `optedOutAt IS NULL`; session messages (within Meta's 24h
customer-service window, replying to an inbound message) do not — this distinction is
enforced in the sending service, not left to the caller.

## 8. LMS evolution (additive columns only)

```ts
-- courses: no change
-- lessons: + mediaProvider: text NOT NULL DEFAULT 'internal' CHECK IN ('internal','youtube','cloudflare_stream')
--          + mediaRef: text  -- YouTube video ID or Cloudflare Stream video UID; NULL for 'internal' (uses existing videoUrl)
-- enrollments: + source: text NOT NULL DEFAULT 'PAYMENT' CHECK IN ('PAYMENT','TEST_PASS','ORGANIZATION','ADMIN','MANUAL')
```

No structural change to `enrollments`/`lessonProgress`/`certificates` — `source` is
descriptive metadata, not a new entitlement path; all existing entitlement queries
continue to work unmodified since they check for the presence of an `enrollments` row,
not its source.

## 9. Outbox / events

```ts
outboxEvent {
  id: text pk
  aggregateType: text NOT NULL          -- e.g. 'enrollment', 'assessmentAttempt', 'whatsappMessage'
  aggregateId: text NOT NULL
  eventType: text NOT NULL              -- e.g. 'enrollment.created', 'assessment.passed'
  payload: jsonb NOT NULL
  idempotencyKey: text NOT NULL UNIQUE
  status: text NOT NULL DEFAULT 'pending' CHECK IN ('pending','dispatched','failed')
  createdAt: timestamp
  processedAt: timestamp
}
INDEX (status, createdAt)   -- worker poll query
```

Written in the same DB transaction as the domain event it represents. A worker
`SELECT ... WHERE status = 'pending' ORDER BY createdAt LIMIT N FOR UPDATE SKIP LOCKED`
polls and calls `JobQueue.enqueue({ idempotencyKey, name, payload, requestedAt })` from
`src/server/queue/contracts.ts`, then marks `dispatched`.

## 10. AI

```ts
aiAgent { id: text pk, name: text NOT NULL, personaScope: text, systemPrompt: text NOT NULL, enabled: boolean NOT NULL DEFAULT false }

knowledgeSource { id: text pk, type: text NOT NULL, ref: text NOT NULL, organizationId: text FK -> organization.id ON DELETE SET NULL }

knowledgeChunk {
  id: text pk
  sourceId: text NOT NULL FK -> knowledgeSource.id ON DELETE CASCADE
  text: text NOT NULL
  embedding: vector(1536)              -- pgvector; dimension per chosen EmbeddingProvider
  courseId: text FK -> courses.id ON DELETE SET NULL      -- entitlement scoping key
  resourceId: text FK -> resources.id ON DELETE SET NULL  -- entitlement scoping key
}
INDEX USING ivfflat (embedding)   -- added once corpus size justifies it, per AI_ARCHITECTURE.md

aiConversation { id: text pk, userId: text NOT NULL FK -> user.id ON DELETE CASCADE, agentId: text NOT NULL FK -> aiAgent.id ON DELETE RESTRICT, createdAt: timestamp }
aiMessage { id: text pk, conversationId: text NOT NULL FK -> aiConversation.id ON DELETE CASCADE, role: text NOT NULL CHECK IN ('system','user','assistant'), content: text NOT NULL, createdAt: timestamp }
aiUsageLog { id: text pk, userId: text NOT NULL FK -> user.id ON DELETE CASCADE, provider: text NOT NULL, inputTokens: integer NOT NULL, outputTokens: integer NOT NULL, durationMs: integer NOT NULL, success: boolean NOT NULL, createdAt: timestamp }
INDEX (userId, createdAt)    -- quota window queries for AIUsageMeter.assertWithinQuota
```

`knowledgeChunk.courseId`/`resourceId` are what let a `Retriever` implementation filter
by the caller's actual entitlement (`enrollments`/`purchases`) before a chunk is ever
handed to an LLM — this is the DB-level hook the existing `Retriever` interface comment
("MUST apply user entitlement filters") requires.

## Migration ordering constraints

- `personaMembership` and `organization`/`organizationMembership` have no dependency on
  each other and can migrate independently, but both must exist before `relationship`
  (which references `organization` optionally) and before `contact`/`cohort` (which
  reference `organization` optionally).
- `relationship` depends on `user` and `courses` only (both already exist).
- `contact` has no dependency on CRM's own conversation/message/opportunity tables —
  migrate `contact` first, then `contactTag`/`contactNote`/`conversation`/`message`/
  `opportunity` together.
- `appointment*`/`assessmentAttempt`/`accountInvitation` depend on `contact` — migrate
  after CRM.
- `whatsapp*` tables depend on `conversation` (for `whatsappMessage.conversationId`) —
  migrate after CRM.
- `enrollments.source` and `lessons.mediaProvider`/`mediaRef` are additive columns with
  server-side defaults — safe to add without a backfill migration beyond the default.
- `outboxEvent` has no FK dependencies on new tables (aggregate references are
  loosely-typed `aggregateType`/`aggregateId`, intentionally not FKs, since it must be
  able to reference rows across many aggregate tables) — can migrate any time before the
  first phase that writes to it.
- `ai_*` tables depend on `organization`/`courses`/`resources` only — independent of
  CRM/WhatsApp, can migrate in parallel with them.

## Named database-constraint requirements (explicit examples the roadmap must implement)

1. **`personaMembership` primary uniqueness**: partial unique index on `userId WHERE
   isPrimary` — prevents two primaries via a race between two concurrent "set primary
   persona" requests.
2. **`relationship` self-reference guard**: `CHECK (subjectUserId != objectUserId)` —
   a user must never be recorded as their own parent/AVS/specialist.
3. **`accountInvitation` single-use**: enforced via `UPDATE ... WHERE id = $1 AND
   consumedAt IS NULL`, not just an application-level "already consumed" check, so a
   concurrent double-submit cannot create two users from one invitation.
4. **`whatsappWebhookEvent.metaMessageId` / `whatsappMessage.whatsappMessageId`
   uniqueness**: required for Meta's at-least-once webhook delivery guarantee — without
   it, a retried webhook delivery double-processes a status update or double-creates an
   inbound message.
5. **`appointmentSlot` capacity**: enforced transactionally (row lock + count check) at
   booking time, not just a `CHECK` on the slot row, since capacity is a function of
   the *related* `appointment` rows, which a single-table `CHECK` cannot express in
   Postgres.
6. **`outboxEvent.idempotencyKey` uniqueness**: guarantees a redelivered/retried worker
   pickup cannot enqueue the same job twice.
7. **`cohortMembership` one-cohort-per-enrollment**: `UNIQUE (enrollmentId)` prevents a
   single enrollment being double-counted in two cohorts' rosters/capacity.
8. **`contact.convertedUserId` uniqueness**: prevents two contacts from both claiming
   conversion into the same user, which would corrupt CRM attribution/reporting.
