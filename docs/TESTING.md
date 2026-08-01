# Testing strategy

Testing is layered so a green build is not mistaken for secure behavior.

## Core local gate
After dependencies and a lockfile are installed:
```bash
npm run typecheck
npm run lint
npm run test
npm run security:audit
npm run build
npm run verify
```
Shortcut:
```bash
npm run check
```

## Unit/security tests
```bash
npm run test:unit
npm run test:security
```
Current regression coverage includes:
- locale-scoped open-redirect allowlist;
- bounded JSON body parsing and oversized request rejection;
- raw/dynamic SQL-danger primitive checks on high-risk source paths;
- dangerous `eval`/Function/child-process/raw HTML source-policy checks.

## PostgreSQL integration
With the standard local Docker stack, the integration tests default to `postgresql://anei:anei@127.0.0.1:5432/anei` outside production. Apply migrations first:
```bash
npm run db:migrate
npm run test:integration
```
For an isolated/disposable test DB, override it explicitly:
```bash
TEST_DATABASE_URL=postgresql://... npm run test:integration
```
Tests verify authoritative DB constraints exist/behave. Expand integration coverage whenever transactional business logic changes.

## E2E
Install Chromium once after installing/updating Playwright:
```bash
npm run test:e2e:setup
```
Then:
```bash
npm run build
npm run start
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```
Current Playwright baseline checks FR/AR document semantics, public navigation, anonymous private-route denial, CSP/nosniff headers, foreign-Origin mutation rejection and anonymous admin mutation denial.

Required staging acceptance journeys before production:
- email registration -> verification -> login -> logout -> reset;
- Google OAuth real sandbox/project callback;
- catalog -> purchase -> entitlement -> module/lesson -> progress -> certificate;
- owned resource download + foreign-user/anonymous IDOR denial;
- webinar registration/access;
- ADMIN content operations and SUPER_ADMIN role protections;
- Flouci sandbox success/failure/retry/reconciliation;
- RTL keyboard/mobile accessibility smoke.

## Load
`tests/load/k6-smoke.js` is bounded to ANEI local/staging public endpoints. Do not load-test Google, Flouci or ClicToPay. Mock external integrations and measure p50/p95/p99, errors, DB connections, CPU and memory.

## Security scope
Only scan/test ANEI-owned local/staging hosts for which you have authorization. See `PENTEST_PLAN.md`.
