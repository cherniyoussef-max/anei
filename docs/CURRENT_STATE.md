# Current state — ANEI Platform

## Scope
ANEI is a bilingual FR/AR learning platform for inclusive education. The repository now implements a production-oriented modular monolith: public academy site, LMS, webinars, protected digital library, AVS directory, commerce, account security and role-gated administration.

## Architecture inventory
- **Frontend:** Next.js App Router, React Server Components by default, client components only for forms/player/session controls, Tailwind/CSS design system.
- **Server:** Next.js Route Handlers with same-origin mutation guards, bounded body parsing, Zod validation, Better Auth sessions and service-layer business logic.
- **Data:** PostgreSQL + Drizzle; four versioned SQL migrations including LMS modules/chapters; Redis is ephemeral infrastructure for distributed rate limiting and future jobs/cache.
- **Auth:** email/password, email verification/reset, optional Google OAuth, connected-account display, session list/revocation and USER/ADMIN/SUPER_ADMIN RBAC.
- **Commerce:** provider abstraction; mock is development-only, Flouci adapter verifies server-to-server, ClicToPay intentionally fails closed until official merchant protocol/certification is supplied.
- **Media:** development demo files; production private S3-compatible object storage with authorized short-lived signed download/media URLs and admin presigned uploads.
- **LMS:** courses -> optional modules/chapters -> lessons, server-backed progress, entitlement-protected learning, resume/previous/next navigation and unique certificates.
- **i18n/a11y:** French + Arabic document-level `lang`/`dir`, RTL, skip link, focus styles and reduced-motion support.
- **Admin:** content operations plus dedicated paginated users, orders/reconciliation and audit views; sensitive role changes are SUPER_ADMIN-only.
- **Deployment:** standalone non-root Next.js container; external managed PostgreSQL/Redis/storage/SMTP/payment services expected in production.

## Feature status
| Area | Status | Notes |
|---|---|---|
| Public site/news/catalog/AVS/library | Working | PostgreSQL-backed; server-side search/filter/sort/pagination for discovery pages. |
| Email/password auth | Working/configurable | Better Auth; production requires HTTPS, strong secret and email verification. |
| Google OAuth | Configurable | Requires real Google OAuth credentials and production callback registration. |
| Account security | Working baseline | Connected providers, active sessions, revoke one/all-other sessions, privacy-safe JSON export. |
| Course entitlements | Working | Enforced server-side; UI ownership state follows DB state. |
| Course modules/chapters | Implemented | Backward-compatible nullable lesson module assignment. |
| Learning progress | Working/hardened | Client reports playback position; server derives completion and course progress. Not DRM. |
| Certificates | Working baseline | One certificate per user/course; asynchronous branded PDF generation remains future work. |
| Webinars | Working baseline | Registration/meeting access is server protected; external meeting-provider abstraction can be added later. |
| Flouci | Adapter implemented | Requires official sandbox/merchant credentials and acceptance verification before launch. |
| ClicToPay | Disabled by design | No guessed API; requires acquiring-bank/SMT technical pack and certification. |
| Protected resources/media | Production architecture implemented | S3-compatible configuration is mandatory in production. |
| Admin | Operational | Core content forms + paginated user/order/audit screens, role checks and audit trail. Some entity-specific enterprise CRUD screens remain optional refinement. |
| AI/RAG | Contracts/architecture only | Production flag fails closed until retrieval, authorization, quotas and evaluation exist. |
| Tests | Meaningful baseline | Unit/security, PostgreSQL integration hook, Playwright public/security smoke and k6 bounded load profile. |
| CI/CD | Configured | CI, CodeQL and Dependabot are included; a committed package-lock is still required. |

## Critical blockers before real production launch
1. Generate and commit `package-lock.json` on a registry-connected machine, then execute the full dependency-backed quality gate.
2. Provision staging/production managed PostgreSQL, private Redis, S3-compatible storage, SMTP, TLS/CDN/WAF and secret management.
3. Acceptance-test Google OAuth and Flouci in official sandboxes/merchant environments; obtain ClicToPay contract if it will be offered.
4. Run the documented E2E/security/load plans against an ANEI-owned staging environment and remediate findings.
5. Complete Tunisian privacy/consumer/e-commerce/legal review and define retention/deletion obligations for financial and certificate records.
6. Configure monitoring/error tracking/alerts and perform a backup restore drill before launch.

## Residual risks / deliberate non-claims
- Browser playback position cannot prove a human learned the material. High-assurance certification should add assessments or trusted playback telemetry.
- CSP, WAF and rate limits are defense-in-depth; application authorization remains mandatory.
- Presigned upload architecture still needs production malware scanning/media processing if untrusted uploads become common.
- MFA is not enabled yet. The flag fails closed until a supported Better Auth flow, recovery process and UX are implemented/tested.
- AI is not a production feature yet; only clean boundaries/contracts exist.
- This repository is **production-oriented**, not certified secure or legally approved. A deployment-specific review and pentest remain required.
