# ANEI Platform

Production-oriented foundation for **Académie Nationale de l'Éducation Inclusive — الأكاديمية الوطنية للتربية الدامجة**: bilingual FR/AR public site, LMS, webinars, digital library, AVS directory, commerce and administration.

> This repository is designed to become a real production service, but external credentials, staging acceptance tests, legal review and the final dependency/build gate are still required before launch. See `docs/PRODUCTION_CHECKLIST.md`.

## Stack
- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS 4 / ANEI design system
- PostgreSQL + Drizzle ORM
- Better Auth: email/password, optional Google OAuth, sessions
- Redis: distributed rate limiting; future cache/queues
- S3-compatible private storage: signed uploads/downloads
- Nodemailer; Mailpit locally
- payment adapter: development mock, Flouci, ClicToPay fail-closed
- Docker + GitHub Actions + CodeQL/Dependabot

## UI/UX system
- Human editorial institutional visual language: cobalt/navy system, warmer neutral surfaces and local documentary-style learning imagery.
- Shared design source of truth: `design-system/anei/MASTER.md`.
- Page-mode overrides for the public homepage, learner dashboard, course player and admin back-office.
- Accessibility-first focus states, reduced motion, responsive layouts and first-class FR/AR RTL behavior.
- Generated production imagery is stored locally under `public/media/`; no third-party image CDN is required for the redesigned surfaces.
- No additional UI framework or animation dependency was added in v3.4.0.

## Main capabilities
### Public
FR/AR + RTL, responsive homepage, courses, course detail/preview, webinars/replays, library, AVS directory, news, contact and newsletter.

### Accounts/LMS
Registration/login/logout/reset/verification, optional Google OAuth, connected providers, active-session revocation, privacy-safe account export, server-backed enrollment, **course modules/chapters**, protected learning workspace, resume/previous/next lesson navigation, video progress, resources, webinars, notifications and certificates.

### Administration
ADMIN/SUPER_ADMIN server RBAC, course/module/lesson/webinar/resource/AVS/news operations, contact handling, dedicated paginated user/order/audit views, safe payment reconciliation, SUPER_ADMIN-only role management and audit events.

### Security baseline
- same-origin/Fetch-Metadata guard for custom mutations;
- Better Auth protections kept enabled;
- Redis-backed rate limits;
- Zod server validation;
- Drizzle parameterized queries + raw-SQL audit;
- transactional payment -> entitlement grant;
- DB check/unique constraints;
- protected S3 object URLs after entitlement validation;
- CSP nonce + production security headers;
- production fail-closed environment validation;
- demo seed refused in production;
- versioned SQL migrations with checksum journal.

## Prerequisites
- Node.js >= 20.19 (Node 22 recommended)
- npm
- Docker for local PostgreSQL/Redis/Mailpit

## First local start
```bash
cp .env.example .env
npm install
# Commit the generated package-lock.json for reproducible CI/builds.
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Open:
- `http://localhost:3000/fr`
- `http://localhost:3000/ar`
- Mailpit: `http://localhost:8025`

The Docker services are development-only and bind DB/Redis/Mailpit to `127.0.0.1`.

## Existing local DB created with the old `db:push` workflow
`npm run db:migrate` now detects a complete legacy v2 schema with no migration journal, records `0000_initial.sql` as the baseline, and applies only later migrations. For both a fresh local DB and the existing v2 development DB, use:
```bash
npm run db:migrate
```
The explicit `npm run db:baseline` command remains available for controlled/manual recovery, but it is no longer required for the normal v2 upgrade path. The migration runner refuses partial/unrecognized schemas instead of guessing.

## Demo accounts
`npm run db:seed` creates local demo users. Read `scripts/seed.ts` for current credentials. The seed refuses `NODE_ENV=production` and production privileged bootstrap uses `npm run db:bootstrap-admin` with explicit environment credentials.

## Quality gate
After dependencies are installed:

Install the Playwright browser once before the E2E suite:
```bash
npm run test:e2e:setup
```
```bash
npm run typecheck
npm run lint
npm run test
npm run security:audit
npm run build
# Local production smoke test (keeps strict real-production startup checks intact):
npm run start:local
npm run verify
```
Core shortcut:
```bash
npm run check
```

## Google OAuth
Set:
```env
ENABLE_GOOGLE_AUTH=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```
Register the Better Auth callback for your actual domain, e.g.:
`https://academy.example.tn/api/auth/callback/google`.
Keep the client secret server-side.

## Payments
### Development mock
```env
PAYMENT_ALLOW_MOCK=true
PAYMENT_DEFAULT_PROVIDER=mock
```
The mock checkout is development-only and uses an explicit signed POST confirmation. Production configuration rejects mock payments.

### Flouci
Set `ENABLE_FLOUCI=true` only after official sandbox configuration and provide the merchant credentials. The application verifies provider state server-side before an entitlement is committed. See `docs/PAYMENTS_FLOUCI.md`.

### ClicToPay
Keep `ENABLE_CLICTOPAY=false` until the official acquiring-bank/SMT merchant protocol, credentials and certification steps are provided. The project intentionally does not invent that API. See `docs/PAYMENTS_CLICTOPAY.md`.

## Protected media
Development demo media may live under `public/demo`.
Production requires:
```env
STORAGE_PROVIDER=s3-compatible
STORAGE_BUCKET=...
STORAGE_REGION=...
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
# STORAGE_ENDPOINT=... # R2/MinIO/custom endpoint; optional for AWS S3
```
Purchased resource downloads authorize the user first and then issue a short-lived signed URL. Admin upload signing is exposed at `/api/admin/storage/presign-upload` and only accepts a restricted file-type/size baseline. See `docs/MEDIA.md`.

## Production
Do not deploy `docker-compose.yml` as the production data tier. Use private/managed PostgreSQL, private Redis, object storage, TLS/CDN/WAF, SMTP and a secret manager.

Release outline:
1. CI/security scans green;
2. backup + reviewed migrations;
3. immutable container deploy;
4. health/smoke tests;
5. provider acceptance tests;
6. monitoring and alert review.

For the existing local v2 database, start with `docs/UPGRADE_FROM_V2.md`.

See `CHANGELOG.md` for the hardening summary.

See:
- `docs/UPGRADE_FROM_V2.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/SECURITY.md`
- `docs/THREAT_MODEL.md`
- `docs/PENTEST_PLAN.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/RUNBOOK.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/VERIFICATION_REPORT.md`
- `docs/SECURITY_REVIEW_MATRIX.md`
- `docs/PRIVACY_AND_DATA_LIFECYCLE.md`
- `docs/ADMIN_OPERATIONS.md`

## AI roadmap
`ENABLE_AI` stays disabled until authorization-filtered retrieval, quotas, provider adapters, prompt-injection/tool defenses and evaluation are implemented. The LLM must never be the authorization layer. See `docs/AI_ARCHITECTURE.md`.


## Troubleshooting local setup
### `Another next dev server is already running`
Stop the PID printed by Next.js, then restart:
```bash
kill <PID>
rm -rf .next
npm run dev
```
Do not run two `next dev` processes for the same working directory.

### `fatal: not a git repository`
A ZIP extraction has no Git metadata. Initialize it before committing the generated lockfile:
```bash
git init
git add .
git commit -m "chore: initial ANEI production baseline"
```
If this source belongs in an existing repository, copy it into that repository instead of creating a second history.

## v3.2.1 dependency compatibility note
`eslint-config-next@16.2.12` accepts ESLint 9+, but several plugins it currently installs still declare peer ranges ending at ESLint 9. This release therefore pins `eslint@9.39.5` until those plugins publish ESLint 10-compatible peer ranges.

Next.js 16.2.12 still declares Sharp `^0.34.5` as an optional dependency while the July 2026 Sharp/libvips security advisory is patched in Sharp 0.35.0+. ANEI pins and overrides Sharp to 0.35.3 and verifies the generated lockfile contains no older Sharp copy. Treat `npm run deps:check` plus `npm run build` as mandatory after every dependency change.

### Local production build vs real production startup

`npm run build` compiles the artifact without requiring live production credentials.
`npm run start:local` is only for loopback smoke tests and refuses non-loopback app/database origins.
`npm run start` remains strict and requires the complete real production configuration (HTTPS, non-demo DB credentials, real SMTP, non-mock payment configuration, and S3-compatible protected storage).

### Standalone local production smoke test (v3.2.3)

This project uses `output: "standalone"`. Build and run the generated minimal server with:

```bash
npm run build
npm run start:local
```

`start:local` is loopback-only and loads the local `.env`. Real production uses `npm run start` with deployment-provided production environment variables.
