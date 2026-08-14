# Deployment & Scaling (Phase 0 — planning only)

Extends `docs/ARCHITECTURE.md`'s existing scaling path — same modular monolith, same
"extract a service only after measured workload/isolation/ownership justifies it"
principle. No microservices, no Kubernetes.

## Target topology

```text
Users
  │ HTTPS
  ▼
DNS → CDN/WAF → Load balancer / reverse proxy
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Next.js A    Next.js B    Next.js N   (web/API — stateless, unchanged)
        │            │            │
        └────────────┼────────────┘
                     │
          bounded connection pool
                     │
               PostgreSQL   ── source of truth: LMS, CRM, admission, WhatsApp
                              state, AI conversations/usage, outbox
                     ▲
                     │ polls outbox_event (SELECT ... FOR UPDATE SKIP LOCKED)
                     │
                Worker process(es)      ── NEW: consumes JobQueue
                     │
        ┌────────────┼─────────────┬───────────────┐
        ▼            ▼             ▼               ▼
     Redis   Meta WhatsApp    Cloudflare       LLM provider
  (cache/    Cloud API        Stream (video)   (chat/embeddings,
   rate limit)                                  disabled by default)
                     │
              private S3-compatible
              object storage (documents/resources — unchanged)
```

Web replicas remain stateless and unchanged. The **worker** is the only new deployable
unit — it is a separate process (not a separate service boundary in the
modular-monolith sense: same repository, same Drizzle schema, same domain modules,
started with a different entrypoint script, e.g. `scripts/worker.ts`, analogous to how
`scripts/seed.ts` already runs standalone against the same DB).

## Why a worker, and why now

Today ANEI has no asynchronous execution path — every side effect happens inline in a
request handler. That is fine for the current feature set (email via SMTP, payment
verification) but breaks down for:
- WhatsApp sends/webhook processing (external API latency/timeouts must not block or
  fail an unrelated user request);
- AI ingestion (`ai.ingest` — embedding a knowledge source is not request-latency work);
- CRM automation triggers (fan-out to potentially many outbound messages).

`src/server/queue/contracts.ts` already anticipated this (`JobQueue`/`JobHandler`,
comment: "select a mature Redis-backed worker implementation during the worker
deployment phase"). This blueprint's Phase 9 (`ROADMAP.md`) is that phase. The concrete
queue implementation choice (e.g., BullMQ over Redis, or a Postgres-native `SKIP
LOCKED` queue) is deferred to that phase's own implementation plan — Phase 0 only fixes
the contract boundary and the outbox pattern feeding it, not the vendor.

## New external dependencies and their scaling posture

| Dependency | Role | Scaling notes |
|---|---|---|
| Meta WhatsApp Cloud API | messaging | Meta-hosted; ANEI's scaling concern is webhook burst handling (queue-buffered, not synchronous) and per-number rate limits Meta itself enforces — respect Meta's messaging rate tiers, back off on 429s in the worker, never retry synchronously inside the webhook handler itself. |
| Cloudflare Stream | protected video hosting/playback | Cloudflare-hosted; removes ANEI's need to self-host transcoding/HLS (the "future high-volume pipeline" in `docs/MEDIA.md` becomes unnecessary for video specifically — Cloudflare Stream absorbs that operational burden). Signed playback tokens are requested per-view, same request-volume shape as today's `signedMediaUrl()` calls. |
| LLM provider | AI chat/embeddings | Disabled by default in production (unchanged from `AI_ARCHITECTURE.md`). When enabled: per-user quota via `AIUsageMeter`, and provider calls happen from request handlers directly for chat (latency-sensitive, synchronous is correct) but from the worker for bulk ingestion (`ai.ingest`, not latency-sensitive). |
| Worker process | outbox dispatch, WhatsApp sends, AI ingestion, CRM automation | Horizontally scalable by running N worker instances against the same `outboxEvent` table; `SKIP LOCKED` polling makes this safe without a distributed lock. |

## Database scaling

Unchanged principle from `docs/ARCHITECTURE.md`: `DB_POOL_MAX × replicas` stays within
DB capacity; add PgBouncer if measured pressure requires it. New considerations:

- The worker holds its own bounded connection pool, separate from web replicas' pool —
  sized independently so a worker backlog cannot starve web-request connections.
- `pgvector` (Phase 10, AI) adds index-maintenance cost (`ivfflat`/`hnsw` index rebuild
  on bulk insert) — schedule bulk knowledge ingestion during low-traffic windows via the
  worker, not synchronously.
- High-write tables introduced here (`whatsappWebhookEvent`, `outboxEvent`,
  `aiUsageLog`) are append-heavy and time-ordered — partition or prune-by-age only if
  measured volume justifies it (per `docs/ARCHITECTURE.md`'s "add only after measured
  workloads justify operational complexity" principle); not a Phase 0 concern.

## Caching rules (extended)

Same rules as `docs/ARCHITECTURE.md` apply to every new domain:
- public CRM/admission data does not exist (there is no "public contact list") — this
  entire feature area is private-dashboard-shaped, never shared-cacheable;
- WhatsApp conversation/message data is private, per-organization/per-user — never
  shared-cacheable across organizations or users;
- entitlement and payment state remain read from authoritative storage for security
  decisions, unchanged — this now explicitly includes `enrollments.source` checks and
  `whatsappOptIn` status, which must never be served from a stale cache when deciding
  whether to send a message or grant access.

## Rollout sequencing (operational, mirrors `ROADMAP.md`'s dependency order)

1. Personas + Organizations (Phases 1–2) — no external dependency, ships first.
2. CRM + Admission (Phases 3–4) — still no external dependency (no worker needed yet;
   internal only).
3. WhatsApp core + verification (Phases 5–6) — first phase requiring the worker and
   Meta credentials; **this is where the worker process is first deployed**.
4. LMS/cohorts, Video (Phases 7–8) — independent of the worker, can interleave with 3.
5. Events/automation (Phase 9) — formalizes the outbox now that Phase 5 proved the
   worker pattern under real external-API load.
6. AI (Phase 10) — first phase requiring an LLM provider credential and pgvector;
   ships disabled-by-default regardless of code completeness, per existing AI stance.
7. Portals, Advanced CRM, Analytics, Production scaling (Phases 11–14) — composition and
   hardening once the underlying domains exist.

## Environment/config additions (Phase 14, `src/server/env.ts` extension)

New required-in-production variables, validated the same way `STORAGE_PROVIDER =
"s3-compatible"` today forces full S3 credential presence in production:
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
`WHATSAPP_APP_SECRET` (for signature verification), `CLOUDFLARE_STREAM_ACCOUNT_ID`,
`CLOUDFLARE_STREAM_API_TOKEN`, and (only if AI is enabled) `LLM_PROVIDER_API_KEY`. None
of these are logged; none are exposed to client code — same rule as existing storage
credentials.
