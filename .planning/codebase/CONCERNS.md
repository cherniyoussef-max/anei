# Codebase Concerns

**Analysis Date:** 2026-10-09

## Tech Debt & Architecture Boundaries

**1. Node.js Engine Pinning:**
- Issue: `package.json` specifies `"node": ">=22.0.0 <23"`. Running on Node 23+ or earlier than Node 22 requires explicit `--ignore-engines` or environment matching.
- Files: `package.json`.
- Impact: CI/CD runners must be locked to Node 22 LTS to avoid deployment failures.

**2. Strict Frozen Surfaces:**
- Issue: `src/app/[locale]/(site)/page.tsx` and `src/components/sections/AcademyHome.tsx` represent the frozen canonical reference design for the home page. Any global CSS modification must verify non-regression on the home page.
- Files: `src/app/[locale]/(site)/page.tsx`, `src/components/sections/AcademyHome.tsx`, `src/app/[locale]/(site)/academy-home.css`.

**3. In-Memory Fallbacks for Redis:**
- Issue: In local environments where Redis is not running, rate limiting and session caching fall back to an in-memory map.
- Files: `src/server/cache/rate-limit.ts`.
- Impact: In multi-process production setups, Redis must be operational; failing closed ensures security but requires high-availability Redis clustering.

## Security Considerations

**1. Secret & Key Redaction:**
- Mitigation: All logging goes through `src/server/security/logger.ts` which redacts secrets.
- Requirement: Always audit new endpoints to ensure tokens, webhook secrets, or customer PII are not leaked in error traces or response query strings.

**2. Presigned URL Expirations:**
- Mitigation: Private media URLs issued via S3 presigner are short-lived (5 to 15 minutes).
- Requirement: Clients must not store or cache presigned media URLs permanently.

## Performance Bottlenecks

**1. Nonce-Based Dynamic Rendering:**
- Note: ADR 0003 establishes per-request nonces via `src/proxy.ts`. While providing superior XSS protection, pages with nonces cannot be cached as static HTML by intermediate CDN edges without proper cache headers.
- Files: `src/proxy.ts`, `src/app/layout.tsx`.

**2. Database Connection Pooling:**
- Note: Under heavy concurrent learner load (e.g. synchronized webinar attendance), PostgreSQL connection pool size (`DB_POOL_MAX`) must be tuned relative to server container concurrency.

---

*Concerns audit: 2026-10-09*
