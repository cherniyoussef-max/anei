# Changelog

## 3.4.0 — human editorial redesign
- Rebuilt the ANEI visual language around documentary-style human imagery, editorial hierarchy, institutional blue, and warmer neutral surfaces.
- Replaced the abstract homepage learning card with a human-centered photographic hero and contextual proof points.
- Added generated local WebP imagery under `public/media/` so the production UI has no third-party image dependency.
- Reworked featured/catalog course cards with photographic covers, clearer metadata hierarchy, and restrained motion.
- Added a human-centered pedagogical story section and refreshed the About experience.
- Humanized authentication and learner dashboard surfaces while preserving Better Auth and session behavior.
- Refined course-detail enrollment, public page heroes, admin density, responsive behavior, and RTL presentation.
- Added `src/lib/visuals.ts` as the shared visual-asset mapping layer.
- Updated the ANEI design system and design research notes using UI/UX Pro Max plus current frontend-design skill guidance and leading education-platform patterns.

## 3.3.0 — professional UI/UX redesign

- Replaced the rejected child-oriented generated design direction with a professional ANEI blue/slate institutional design system.
- Added `design-system/anei/MASTER.md` plus public-home, learner-dashboard, course-player and admin overrides.
- Reworked the public header/footer, homepage hero, real catalog search entry point, domain discovery, course cards, webinars, resources and editorial sections.
- Reframed the learner dashboard around “Continue learning”, with compact progress context and clearer resource/certificate hierarchy.
- Refined the course workspace into a focused learning surface with sticky curriculum navigation, clearer lesson states and RTL-aware directional controls.
- Standardized controls, radii, borders, typography, spacing, focus treatment, status colors, responsive breakpoints and reduced-motion behavior.
- Reworked admin visual density, navigation, filters, tables and panels without changing backend contracts.
- Added no new UI/runtime dependency; auth, RBAC, payments, Drizzle schema/migrations, API routes and standalone deployment behavior remain unchanged.
- Added `docs/DESIGN_REDESIGN_V3_3.md`.
- Added `docs/UIUX_PRO_MAX_IMPLEMENTATION.md` and `docs/APPLY_V3_3_0.md`.

## 3.2.6

- Fixed `start:local` CommonJS transform failure by moving async launcher work into `main()`.
- Preserved loopback-only Better Auth smoke-test configuration and production security guards.

## 3.2.5

- Fixed `scripts/start-local.ts` TypeScript compilation under Next.js environment typings by setting the local smoke environment via `Object.assign(process.env, ...)` instead of assigning to the read-only `process.env.NODE_ENV` property.
- No runtime security policy was weakened; local smoke mode remains loopback-only and production validation remains strict.

# 3.2.2

## 3.2.4 - Local production auth alignment

- `start:local` now derives a single canonical loopback origin from `PORT` and starts the standalone server in-process.
- Local smoke mode aligns `APP_URL`, `BETTER_AUTH_URL`, and `TRUSTED_ORIGINS` automatically.
- Better Auth secure cookies remain enabled in real production but are disabled for the explicit loopback-only local production smoke mode so HTTP login works locally.
- Real production origin/HTTPS/cookie checks remain unchanged.


## 3.2.3

- Fixed standalone runtime startup: `next start` is no longer used with `output: "standalone"`.
- Added post-build standalone asset preparation for `public` and `.next/static`.
- Removed process-spawning helpers that triggered the source security audit.
- `start:local` now binds to `127.0.0.1`, loads `.env`, and runs the generated standalone server.

- Separated Next.js artifact build-time validation from live production runtime validation.
- Added `npm run start:local` for loopback-only production smoke tests.
- Kept `npm run start` fail-closed for real production deployment configuration.

# Changelog

## 3.1.0 — corrective validation release
- fixed legacy-v2 migration/bootstrap flow and local env loading;
- fixed all TypeScript issues reported by the first real v3 validation run;
- fixed reported ESLint failures;
- added explicit Playwright browser setup;
- made local integration tests execute against the documented Docker PostgreSQL instance;
- added practical Git/dev-server troubleshooting and `docs/FIXES_V3_1.md`.

## Production hardening v3 — 2026-07-28

### Security
- fail-closed production environment validation and feature flags;
- same-origin/Fetch-Metadata policy for custom mutations;
- bounded JSON request bodies and Redis-backed rate limits;
- safer redirects, role checks, final-SUPER_ADMIN protection and audit events;
- CSP/security headers, explicit proxy trust and non-root container;
- protected S3-compatible media with presigned POST upload policy and signed GET access;
- transactional/idempotent payment verification and entitlement grant;
- server-derived course completion and unique certificate rules;
- expanded threat model, pentest plan and security review matrix.

### Data/architecture
- versioned SQL migrations with checksum journal and advisory lock;
- one-time baseline path for older databases created with `drizzle-kit push`;
- PostgreSQL integrity constraints and operational query indexes;
- course modules/chapters with backward-compatible lesson assignment;
- bounded DB pool and scalable modular-monolith boundaries.

### Product
- module-aware learner workspace with resume and previous/next navigation;
- server-side paginated course/resource/AVS discovery;
- connected accounts, session/device revocation and data export;
- dedicated paginated admin users/orders/audit views and payment reconciliation;
- FR/AR document direction, focus/skip/reduced-motion accessibility improvements;
- semantic design tokens and premium learning/admin UI patterns;
- three local H.264 demo learning videos retained for development/testing.

### Delivery
- CI + CodeQL + Dependabot configuration;
- SBOM generation command/workflow;
- unit/security/integration/E2E/load test baseline;
- strict lockfile requirement for container/CI builds;
- comprehensive operations, deployment, backup, privacy, media, payment and upgrade documentation.

## 3.2.0 - dependency recovery

- Restores and pins Next.js 16.2.12 after unsafe npm audit downgrade scenarios.
- Pins Sharp 0.35.3 as the runtime image implementation.
- Pins PostCSS 8.5.23 and overrides transitive PostCSS resolution to the patched maintenance release.
- Moves ESLint to 10.7.0, supported by eslint-config-next 16.2.12 (`eslint >= 9`).
- Keeps Drizzle Kit on stable 0.31.10.
- Adds `npm run deps:check` and `docs/DEPENDENCY_RECOVERY.md`.

## 3.2.1 — dependency compatibility repair

- Pin ESLint to the maintained 9.39.5 line because the React/import/a11y plugins currently bundled by `eslint-config-next@16.2.12` do not yet declare ESLint 10 support.
- Fix `deps:check` false negatives for packages that hide `package.json` through export maps.
- Add a Sharp override to keep the full dependency graph on patched Sharp 0.35.3, including Next.js' optional image-optimizer dependency.
- Extend the dependency doctor to reject any nested Sharp below 0.35.0 or PostCSS below 8.5.18 in the generated lockfile.
