<!-- refreshed: 2026-10-09 -->
# Architecture

**Analysis Date:** 2026-10-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              Next.js 16 App Router (Edge & Node)            │
├──────────────────┬──────────────────┬───────────────────────┤
│  Public Site     │   Learner LMS    │     Admin Console     │
│ `app/[locale]/   │ `app/[locale]/   │ `app/[locale]/admin/  │
│  (site)`         │  (learner)`      │                       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 Domain Modules (`src/modules/`)             │
│  lms, learning, admin, crm, admission, personas, whatsapp   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│             Core Platform Services (`src/server/`)          │
│   auth, security, payments, storage, queue, cache, db       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 (Drizzle) │ Redis 7 (Cache/Rate) │ S3 Bucket │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Reverse Proxy & CSP Nonce | Edge security headers, request nonce generation, route proxying | `src/proxy.ts` |
| Auth & RBAC Guard | Authentication lifecycle, session validation, permission checks | `src/server/auth/better-auth.ts`, `src/server/security/` |
| Public Experience | Institutional pages, catalogue, webinars, directory, contact | `src/app/[locale]/(site)/` |
| Learner LMS | Course playback, assessments, quizzes, certificates | `src/app/[locale]/(learner)/` |
| Admin Console | User support, course authoring, analytics, verification | `src/app/[locale]/admin/` |
| Data Layer | Drizzle schemas, typed relational queries, migrations | `src/server/db/schema.ts`, `src/server/queries/` |
| Storage & Media | Presigned S3 uploads/downloads, file access authorization | `src/server/storage/` |

## Pattern Overview

**Overall:** Modular Monolith (ADR 0001) built within Next.js App Router.

**Key Characteristics:**
- **Domain Boundaries:** Core business logic partitioned into focused domains under `src/modules/` and `src/server/services/`.
- **Stateless Application Tier:** All state resides in external transactional stores (PostgreSQL, Redis, S3).
- **Strict Server/Client Boundary:** React Server Components (RSC) handle initial data fetching; Client Components (`'use client'`) handle interactive state only.
- **Fail-Closed Security:** Security validations, origin checks, and rate limits fail closed rather than allowing unauthenticated fallbacks.

## Layers

**1. Presentation & Routing Layer (`src/app/`):**
- Handles HTTP routing, localized path parameters (`/[locale]`), layout composition, and page rendering.
- Separates Public (`(site)`), Learner (`(learner)`), and Admin (`admin/`) experiences.

**2. Domain Feature Modules (`src/modules/`):**
- Encapsulates domain logic for learning, administrative workflows, CRM, and persona-driven features.

**3. Server Infrastructure & Services (`src/server/`):**
- Shared foundational services: database connection pooling, authentication, caching, payments, S3 storage, and background queues.

**4. Data Persistence Layer (`src/server/db/`):**
- Drizzle ORM schema definitions, relations, and transactional database helpers.

## Data Flow

### Primary Learner Progress & Assessment Path

1. Learner submits quiz/attempt (`src/app/api/learning/attempts/[id]/submit/route.ts`)
2. Request validated via Zod and authenticated via session cookie (`src/server/auth/`)
3. Assessment scored, attempts recorded, progress aggregated in PostgreSQL (`src/server/services/learning-assessments.ts`, `src/server/services/progress.ts`)
4. Real-time feedback and certificate eligibility returned to client.

### Secure File Download Path

1. User requests resource download (`src/app/api/storage/download/route.ts`)
2. Server verifies entitlement against user purchase/enrollment in DB (`src/server/services/`)
3. S3 SDK generates short-lived presigned URL (`src/server/storage/s3.ts`)
4. Client redirected to presigned URL; direct access to raw bucket prevented.

## Architectural Constraints

- **Single Deployable Unit:** Keep one monolithic Next.js application without premature microservices extraction (ADR 0001).
- **Private Media Storage:** All course videos and paid PDFs must be private and served via temporary signed URLs (ADR 0002).
- **Per-Request CSP Nonce:** Strict CSP enforced in `src/proxy.ts` with nonces dynamically injected (ADR 0003).
- **Adapter Isolation for AI & Jobs:** AI and background jobs remain strict adapter boundaries without hardcoupling to vendor SDKs (ADR 0004).

## Error Handling

**Strategy:** Fail-closed on security, typed errors on domain boundaries, sanitized responses on API endpoints.
- Mutating API routes check trusted origins and rate limits before processing requests.
- Logger automatically redacts tokens, credentials, and PII before writing logs.

---

*Architecture analysis: 2026-10-09*
