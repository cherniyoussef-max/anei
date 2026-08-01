# ANEI production architecture

## Decision: modular monolith first
ANEI is one deployable Next.js application with explicit domain boundaries. This preserves transactional consistency for LMS/payment operations and keeps operations manageable while still supporting horizontal web scaling. Extract a service only after measured workload, isolation or team ownership justifies it.

```text
Users
  │ HTTPS
  ▼
DNS → CDN/WAF → Load balancer / reverse proxy
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Next.js A    Next.js B    Next.js N
        │            │            │
        └────────────┼────────────┘
                     │
          bounded connection pool
                     │
               PostgreSQL
             (source of truth)

Next.js / future workers ── Redis
Next.js / browser direct ── private S3-compatible object storage / CDN
Next.js ── SMTP
Next.js ── Google OAuth / Flouci / future certified ClicToPay adapter
```

Web replicas are stateless. PostgreSQL owns durable business state. Redis is disposable acceleration/coordination, not authoritative storage. Large media never lives in the application image in production.

## Current domain boundaries
- **auth/account:** Better Auth, providers, sessions, profile/security/export.
- **catalog/courses:** public discovery, course metadata, modules/chapters and lessons.
- **learning:** enrollment, progress, protected media, completion and certificates.
- **commerce/payments:** sellable items, orders, provider checkout/verification, entitlements and reconciliation.
- **resources/media:** digital library, purchases, private object access/upload policy.
- **webinars:** public metadata, registration and protected meeting/replay access.
- **AVS:** directory/search and administration/moderation.
- **admin/audit:** privileged operations, paginated operational views and audit events.
- **notifications/email:** in-app notification data and SMTP abstraction.
- **security/observability:** origin policy, body limits, rate limiting, logging, health/readiness.
- **AI/queue:** provider-neutral contracts only; production disabled until security/evaluation is complete.

## Request boundaries
A normal custom state-changing route follows this order where applicable:
1. reject untrusted browser provenance/origin;
2. authenticate actor;
3. authorize role/ownership/entitlement;
4. rate-limit actor/request fingerprint;
5. read only a bounded request body;
6. validate/normalize with Zod;
7. call service/domain logic;
8. commit multi-step state atomically when consistency requires it;
9. audit/log safe metadata;
10. return normalized non-sensitive errors.

Better Auth owns its own authentication route protections. External payment webhooks are intentionally not same-origin browser routes; they treat payloads as hints and re-verify provider state server-to-server.

## LMS hierarchy
```text
Course
 ├─ Module/Chapter (optional for backward compatibility)
 │   ├─ Lesson
 │   └─ Lesson
 └─ Ungrouped legacy lesson (supported)

User → Enrollment → LessonProgress → Course completion → Certificate
```

The server derives completion from persisted progress rules. A browser cannot directly set authoritative course progress/certificate state.

## Commerce invariant
```text
Authenticated user
 → server resolves published item + authoritative price
 → local order/idempotency
 → provider checkout
 → return/webhook trigger
 → server-to-server verification
 → validate amount/reference
 → DB transaction:
      payment/order state
      entitlement
      notification
      audit
```

A browser success query parameter is never payment proof.

## Media invariant
Production uploads use a private S3-compatible bucket. Admins receive a short-lived presigned POST policy with allowlisted content type and server-bounded length range. ANEI persists only private object keys. Learners receive short-lived signed GET URLs after authorization.

Future high-volume pipeline:
```text
presigned upload → quarantine → malware/metadata checks → video transcode/HLS
→ publish metadata → CDN-authorized playback
```

## Scaling path
1. Start with one application replica + managed PostgreSQL/private Redis/object storage.
2. Add CDN caching for public/static assets and horizontal Next.js replicas.
3. Keep `DB_POOL_MAX × replicas` within DB capacity; add PgBouncer if measured pressure requires it.
4. Move noncritical asynchronous work to durable workers/queues when latency or retry behavior justifies it.
5. Add read replicas/search/vector infrastructure only after measured workloads justify operational complexity.

## Caching rules
- public catalog/news/metadata may be cached with deliberate invalidation;
- private dashboards/learning/account/admin data must never be shared-cacheable across users;
- entitlements and payment state are read from authoritative storage, not Redis cache, for security decisions.

## AI extension boundary
Future AI request path:
```text
user → auth/quota → authorized retrieval filter → LLM gateway
                                      └→ tool registry; every tool re-authorizes
```
The model is never an authorization layer. Private chunks are filtered before model exposure. See `AI_ARCHITECTURE.md`.

## UI architecture — v3.3
The UI is governed by `design-system/anei/MASTER.md`, with page-mode overrides under `design-system/anei/pages/`. Shared CSS tokens in `src/app/globals.css` provide a single visual contract for public, learner and admin experiences. The redesign deliberately avoids a second component framework: existing server/client boundaries, API contracts and business logic stay intact while shared layout primitives and semantic class families propagate the visual system.
