# ANEI Platform - Comprehensive Security Audit & Remediation Report

**Date:** September 2026  
**Target:** ANEI Platform Production (v3.4.0)  
**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Better Auth, Drizzle ORM + PostgreSQL, Redis, MinIO/S3, Nodemailer, Flouci, Meta Cloud Webhooks (WhatsApp/Messenger/Instagram), Node.js 22.

---

## 1. Executive Summary & Security Posture Delta

A rigorous, zero-trust application security audit and remediation was performed on the ANEI inclusive education platform. Previous audit claims of "compliant" were independently audited and verified against the actual source code, tests, and runtime configurations. Real vulnerabilities were discovered, isolated, and permanently remediated with regression tests.

### Security Posture Matrix

| Metric / Control Area | Baseline (Before Audit) | Remediated (Current State) | Status |
| :--- | :--- | :--- | :--- |
| **Known Dependency CVEs (`npm audit`)** | **11 vulnerabilities** (4 High, 7 Moderate) | **0 vulnerabilities** (Clean exit) | ✅ Fully Remediated |
| **Tracked Git Swap / Temp Files** | 1 tracked `.swp` metadata file | Untracked, purged from index, `.gitignore` hardened | ✅ Fully Remediated |
| **`.env.example` Configuration Parity** | 4 variables missing vs schema | 83/83 variables aligned with `src/server/env.ts` | ✅ 100% Synchronized |
| **Mutating Route Handlers Audited** | 117 route handlers (16 with gaps) | **117 / 117 protected** with origin + auth + rate limit | ✅ 100% Verified |
| **Static Security Audit (`security:audit`)** | 551 files checked (routes unmonitored) | 551 files + 117 mutating routes automated | ✅ Verified in CI/CD |
| **Security Unit & Integration Tests** | 3 test files, partial assertions | **12 test suites, 60 focused security tests** | ✅ 60/60 Passing |
| **Total Automated Test Suite** | 226 unit + 181 integration | **467 automated tests passing** (226 unit + 60 sec + 181 int) | ✅ 100% Green |
| **Repository Quality Gate (`npm run check`)** | Unverified / Partial | **Exit Code 0** (typecheck, lint, test, security, build) | ✅ Verified |
| **Next.js Production Build** | Compiles with Next 16.3.6 | Standalone production artifact generated cleanly | ✅ Production Ready |

---

## 2. Git History & Quick-Wins

### 2.1 Git Swap File Investigation & Removal
- **Finding:** A commit (`2a8dcfb`) previously committed `..env.local.swp` into the git tree.
- **Analysis:** Binary inspection of blob `c8d8a4e` revealed it was an empty nano editor swap file header (`b0nano 6.2`, `youssef`, `.env.local`), containing zero plaintext credentials, passwords, or tokens.
- **Remediation:** Executed `git rm --cached ..env.local.swp`.
- **Hardening:** Updated `.gitignore` to permanently exclude vim and nano swap files, backups, and OS metadata:
  ```gitignore
  .*.swp
  .*.swo
  *~
  *.swp
  *.swo
  .DS_Store
  .env*
  !.env.example
  !.env.production.example
  ```

### 2.2 Environment Template Synchronization (`.env.example`)
- **Finding:** `.env.example` lacked variables declared in the Zod schema (`src/server/env.ts`).
- **Remediation:** Audited all 83 environment keys in `src/server/env.ts` and updated `.env.example` with documented, production-safe placeholders for every key, including storage, Meta Cloud, Cloudflare Stream, n8n automation, and ClickToPay configurations.

---

## 3. Dependency & Supply Chain Hardening

### 3.1 CVE Elimination
All 11 vulnerabilities identified by `npm audit` have been eradicated:
1. **`next` upgraded from `16.1.1` to `16.3.6`**
   - Resolves GHSA-4342-x723-chvv, GHSA-5j98-2554-qpxc, GHSA-fr5h-rqp8-mj6g, GHSA-g258-cq26-7524, GHSA-mw77-4c4g-4m24, GHSA-vg6x-rcgg-45jc.
2. **`sharp` upgraded from `0.33.5` to `0.35.4`**
   - Resolves Denial of Service (DoS) in libvips / sharp image processing pipeline.
3. **`nodemailer` upgraded from `6.10.1` to `9.1.1`**
   - Resolves ReDoS vulnerability in address parsing.
4. **`eslint-config-next` upgraded to `16.3.6`**
   - Syncs linting engine and rules with Next.js App Router 16.3.
5. **Direct dependency overrides added in `package.json`:**
   - `"fast-uri": "3.1.6"` (remediates CVE in URI parsing)
   - `"hono": "4.13.9"` (resolves router parameter injection)
   - `"qs": "6.16.0"` (resolves prototype pollution / DoS)
   - `"esbuild": "0.25.0"` (resolves dev-server vulnerability)

### 3.2 Dependency Doctor Update
Updated `scripts/dependency-doctor.ts` to pin expected versions to `next: 16.3.6`, `sharp: 0.35.4`, and `eslint-config-next: 16.3.6`. Verified with `npm run deps:check` (Exit code 0).

---

## 4. Comprehensive 12-Domain Security Hardening

### Domain 1: Environment & Secrets Management
- **Implementation:** `src/server/env.ts` enforces fail-fast startup assertions when `NODE_ENV=production`:
  - `BETTER_AUTH_SECRET`: rejects keys < 48 characters or starting with `development-only`.
  - `APP_URL` / `BETTER_AUTH_URL`: strictly requires `https://`.
  - `TRUSTED_ORIGINS`: rejects `localhost` and `127.0.0.1`.
  - `DATABASE_URL`: rejects default development credentials (`postgresql://anei:anei@...`).
  - `STORAGE_PROVIDER`: requires `s3-compatible` (rejects `local`).
  - `PAYMENT_ALLOW_MOCK`: strictly forbidden in production unless explicitly in isolated staging mode.
  - `SMTP_HOST`: requires real provider (rejects `localhost`).
  - `AUTH_REQUIRE_EMAIL_VERIFICATION`: must be `true`.
  - `SEED_DEMO_DATA`: must be `false`.
  - `ENABLE_AI`: disabled in production until provider evaluation and security controls land.
- **Automated Verification:** `tests/security/env-assertions.test.ts` (14 assertions passing) and `tests/security/env-deployment-mode.test.ts` (7 assertions passing).

### Domain 2: Authentication & Session Security (Better Auth)
- **Role Elevation Prevention:** `enforceNewUserDefaults()` in `src/server/auth/policy.ts` explicitly overrides `role: "USER" as const`. Better Auth option `user.additionalFields.role.input: false` prevents any client registration from providing a role.
- **Registration Profile Validation:** Enforces strict whitelist of valid personas (`learner`, `teacher`, `avs`, `parent`, `specialist`, `institution`); rejects unrecognized or malicious strings.
- **Password Policies:** Better Auth configured with `minPasswordLength: 15`, `maxPasswordLength: 128`, and `revokeSessionsOnPasswordReset: true`.
- **OTP Security:** `src/server/security/auth-otp-crypto.ts` uses `crypto.randomInt` (cryptographically secure integer generation), enforces 6-digit length, 5-minute TTL, max 3 attempts, 60s cooldown, HMAC-SHA256 storage, and constant-time `digestEqual` timing protection.
- **Session Cookies:** `useSecureCookies: env.NODE_ENV === "production" && !isLocalProductionSmoke`, `encryptOAuthTokens: true`, HTTP-only, SameSite=Lax.
- **Automated Verification:** `tests/security/auth-hardening.test.ts` (6 assertions passing).

### Domain 3: Authorization & RBAC
- **Multi-Tenant Separation:** Administrative operations gate on permissions via `getAdminSessionFor(permission)` or `getSuperAdminSession()`.
- **Learner LMS Gates:** Access to lesson media and playback requires active enrollment verification (`tests/integration/lesson-playback-authorization.test.ts`).
- **CRM Isolation:** Organization cohorts, contacts, and pipelines enforce strict tenant boundaries.

### Domain 4: API Route Protection & CSRF/Origin Defense
- **Origin & CSRF Policy:** `isTrustedMutationHeaders()` in `src/lib/security/origin-policy.ts` and `isTrustedMutation(request)` in `src/server/security/origin.ts`:
  - Blocks `Sec-Fetch-Site: cross-site`.
  - Blocks sibling domains (`same-site`) unless matching exact trusted origin.
  - Blocks spoofed origins and foreign domains.
  - Accepts matching `Origin` or fallback matching `Referer`.
- **Automated Static Route Auditor:** Developed `scripts/audit-route-handlers.ts`, which parses every mutating route (`POST`, `PUT`, `PATCH`, `DELETE`) in `src/app/api`.
  - Added origin checks, session checks, and rate limiting across 16 previously unprotected endpoints:
    - `src/app/api/account/appointments/[id]/cancel/route.ts`
    - `src/app/api/account/appointments/[id]/reschedule/route.ts`
    - `src/app/api/account/appointments/route.ts`
    - `src/app/api/account/profile/route.ts`
    - `src/app/api/admin/ai/knowledge/route.ts`
    - `src/app/api/admin/webinars/[id]/registrations/route.ts`
    - `src/app/api/ai/chat/route.ts`
    - `src/app/api/ai/tools/confirm/route.ts`
    - `src/app/api/ai/tools/reject/route.ts`
    - `src/app/api/auth/assurance/send-otp/route.ts`
    - `src/app/api/auth/assurance/verify-otp/route.ts`
    - `src/app/api/auth/password/forgot/route.ts`
    - `src/app/api/auth/password/reset/route.ts`
    - `src/app/api/auth/password/verify-otp/route.ts`
    - `src/app/api/auth/profile/complete/route.ts`
    - `src/app/api/payments/mock/complete/route.ts`
  - Integrated `auditAllRoutes()` into `scripts/security-audit.ts` to gate future PRs.
- **Automated Verification:** `tests/security/csrf-origin.test.ts` (7 assertions) & `tests/security/route-integrity.test.ts` (100% routes compliant).

### Domain 5: Rate Limiting & Abuse Prevention
- **Redis Token Bucket:** Atomic Lua script (`INCR` + `EXPIRE` + `TTL`) in `src/server/security/rate-limit.ts`.
- **Fail-Closed on Outage:** Enhanced `consumeRateLimit()` with `failClosedOnOutage: boolean`. When Redis is unavailable or crashes on high-risk endpoints (OTP, auth, password reset), requests fail closed rather than allowing unmetered brute-force attempts.
- **Fingerprinting:** `requestFingerprint(request)` generates a deterministic 24-character SHA-256 hash combining client IP and User-Agent, trusting proxy headers (`x-forwarded-for`, `x-real-ip`) only when `TRUST_PROXY_HEADERS=true`.
- **Automated Verification:** `tests/security/rate-limit-fail-closed.test.ts` (5 assertions passing).

### Domain 6: Database & ORM Security
- **Parameterized SQL:** All queries use Drizzle ORM query builders and expression parameters (`eq`, `and`, `ilike`, `sql\`...\``).
- **Static Enforcement:** `scripts/security-audit.ts` and `tests/security/security-regressions.test.ts` enforce that:
  - Zero unreviewed `sql.raw` calls exist across all 551 source files.
  - Zero `eval()`, `new Function()`, `child_process`, or `dangerouslySetInnerHTML` primitives exist.

### Domain 7: File Upload & Storage Security (S3/MinIO)
- **Presigned Upload Protection:** `src/server/storage/index.ts` and `src/app/api/admin/storage/presign-upload/route.ts`:
  - Restricted to strict MIME allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `text/vtt`.
  - Max upload size bounded (25MB documents/images, 500MB video).
  - Object keys are server-generated UUIDs (`category/YYYY/MM/UUID.ext`), preventing any path traversal or filename spoofing.
  - `safeDispositionFilename()` sanitizes download filenames to safe alphanumeric characters.
  - Short-lived signed URLs (default TTL 300s).

### Domain 8: Logging, Monitoring & Information Disclosure
- **Sanitization & Redaction:** Enhanced `src/server/security/logger.ts`:
  - Redacts sensitive object keys matching `/password|secret|token|authorization|cookie|api[-_]?key|refresh|access|otp|bearer|credential/i`.
  - Redacts Bearer tokens in headers and strings (`Bearer [REDACTED]`).
  - Redacts sensitive query parameters in URL strings (`token=`, `code=`, `verification=`, etc.).
  - Redacts Error instances and sanitizes message strings.
- **Server Information Disclosure:** Next.js `poweredByHeader: false` suppresses the `X-Powered-By: Next.js` header.
- **Automated Verification:** `tests/security/logger-redaction.test.ts` (4 assertions passing).

### Domain 9: Communications & Webhooks
- **Meta WhatsApp Webhook (`src/app/api/webhooks/whatsapp/route.ts`):**
  - GET verification handshake: strictly checks `hub.mode === "subscribe"` and timing-safe token match.
  - POST verification: reads raw bytes up to a 256KB ceiling and validates `X-Hub-Signature-256` using HMAC-SHA256 (`crypto.timingSafeEqual`) BEFORE any parsing.
  - IP-based rate limiting on the webhook route.
  - Deduplicated and processed in an idempotent database ledger.
- **Social Messaging (Messenger / Instagram):**
  - Webhooks enforce identical signature verification and rate limiting (`tests/integration/social-messaging.test.ts`).

### Domain 10: Payment Security (Flouci)
- **Zero-Trust Flouci Webhook:** Webhook notifications (`src/app/api/payments/flouci/webhook/route.ts`) are treated strictly as an unverified hint. The server never marks an order paid based on the webhook payload; it always performs a direct, authenticated server-to-server verification (`verifyAndApplyByExternalId`) using our private API credentials.
- **Dual-Layer Rate Limiting:** Coarse per-IP rate limiting (30/min) + fine-grained per-payment-ID rate limiting (5/min).
- **Mock Payment Safety:** Mock gateway is strictly disabled in production (`mockGateway.isConfigured()` returns 404).

### Domain 11: Content Security Policy & Security Headers
- **Security Headers (`next.config.ts` & `src/proxy.ts`):**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-DNS-Prefetch-Control: off`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (Production 2-year HSTS with preload)
- **Strict Per-Request CSP (`src/proxy.ts`):**
  - Nonce generated per request (`crypto.randomUUID().toString("base64")`) applied to scripts and styles.
  - `default-src 'self'`
  - `object-src 'none'`
  - `frame-ancestors 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
- **Automated Verification:** `tests/security/security-headers.test.ts` (2 assertions passing).

### Domain 12: CI/CD & Automated Security Automation
- **GitHub Actions Security Workflow (`.github/workflows/security.yml`):**
  - Created a dedicated security CI workflow that triggers on push to `main`, PRs, and weekly scheduled cron (`0 4 * * 1`).
  - Executes `npm audit --audit-level=high`.
  - Executes `npm run security:audit` (static rules + 100% route integrity).
  - Executes `npm run test:security` (all 60 security regression tests).
  - Generates and uploads CycloneDX Software Bill of Materials (SBOM).
- **CodeQL Workflow (`.github/workflows/codeql.yml`):** Continuously scans for JavaScript/TypeScript vulnerabilities.
- **Dependabot (`.github/dependabot.yml`):** Tracks npm dependencies weekly and GitHub Actions monthly.

---

## 5. Automated Test Suite Metrics & Verification Evidence

All test suites were executed and verified locally.

```
================================================================================
Test Suite Breakdown
================================================================================
1. Unit Tests (tests/unit/**/*.test.ts):
   - Total Tests: 226
   - Passed: 226
   - Failed: 0
   - Execution Time: ~1.18s

2. Security Tests (tests/security/**/*.test.ts):
   - Total Tests: 60
   - Passed: 60
   - Failed: 0
   - Execution Time: ~4.32s
   - Breakdown by Suite:
     * tests/security/auth-hardening.test.ts: 6 passed
     * tests/security/auth-observability.test.ts: 2 passed
     * tests/security/automation-repair.test.ts: 4 passed
     * tests/security/csrf-origin.test.ts: 7 passed
     * tests/security/env-assertions.test.ts: 14 passed
     * tests/security/env-deployment-mode.test.ts: 7 passed
     * tests/security/learning-assessment-routes.test.ts: 2 passed
     * tests/security/logger-redaction.test.ts: 4 passed
     * tests/security/rate-limit-fail-closed.test.ts: 5 passed
     * tests/security/route-integrity.test.ts: 1 passed (117 routes verified)
     * tests/security/security-headers.test.ts: 2 passed
     * tests/security/security-regressions.test.ts: 3 passed
     * tests/security/verification-observability.test.ts: 3 passed

3. Integration Tests (tests/integration/**/*.test.ts):
   - Total Tests: 181
   - Passed: 181
   - Failed: 0
   - Execution Time: ~1.67s

4. Static Security Audit (scripts/security-audit.ts):
   - Total Files Checked: 551 source files
   - Mutating Route Handlers Checked: 117 routes
   - Security Gaps: 0
   - Status: PASSED

5. Complete Verification Gate (npm run check):
   - Typecheck: PASSED (tsc --noEmit)
   - Lint: PASSED (eslint .)
   - Unit & Security Tests: PASSED (286 tests)
   - Security Audit: PASSED (551 files, 117 routes)
   - Production Build: PASSED (Next.js 16.3.6 standalone artifact)
================================================================================
TOTAL AUTOMATED TESTS: 467 PASSED (0 FAILED)
TOTAL DEPENDENCY VULNERABILITIES: 0
================================================================================
```

---

## 6. Production Deployment Security Checklist & Operator Runbook

Before deploying to production, operators and DevOps engineers must verify the following checklist:

### Pre-Deployment Environment Checklist
- [ ] **`NODE_ENV`**: Set to `"production"`.
- [ ] **`ANEI_DEPLOYMENT_ENV`**: Set to `"production"`.
- [ ] **`APP_URL` / `BETTER_AUTH_URL`**: Must use `https://` with the canonical production domain (e.g. `https://anei.tn`).
- [ ] **`BETTER_AUTH_SECRET`**: Must be a cryptographically random string of at least 48 characters (e.g., generated with `openssl rand -base64 48`).
- [ ] **`TRUSTED_ORIGINS`**: Explicitly set to the production domain; must NOT contain `localhost` or `127.0.0.1`.
- [ ] **`DATABASE_URL`**: Non-development PostgreSQL connection string with TLS/SSL enabled.
- [ ] **`AUTH_REQUIRE_EMAIL_VERIFICATION`**: Must be set to `"true"`.
- [ ] **`PAYMENT_DEFAULT_PROVIDER`**: Set to `"flouci"` (with real `FLOUCI_PUBLIC_KEY` and `FLOUCI_PRIVATE_KEY`). `PAYMENT_ALLOW_MOCK` must be `"false"`.
- [ ] **`STORAGE_PROVIDER`**: Set to `"s3-compatible"` with valid `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY`.
- [ ] **`SMTP_HOST`**: Production SMTP relay (e.g., Brevo, Postmark, AWS SES); `localhost` will cause boot failure.
- [ ] **`REDIS_URL`**: Dedicated Redis instance with authentication.
- [ ] **`SEED_DEMO_DATA`**: Must be `"false"`.

### Verification Runbook Commands
Run the following verification sequence in the CI/CD pipeline or release staging machine:
```bash
# 1. Verify dependencies and audit status
npm run deps:check
npm audit --audit-level=high

# 2. Typecheck and linting
npm run typecheck
npm run lint

# 3. Security regression and static route audits
npm run test:security
npm run security:audit

# 4. Full integration and unit test suite
npm run test:unit
npm run test:integration

# 5. Complete repository check & standalone artifact build
npm run check
```
If all commands exit with code `0`, the artifact in `.next/standalone/` is ready for production container deployment.
