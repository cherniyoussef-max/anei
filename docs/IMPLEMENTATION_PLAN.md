# Implementation plan

This plan reflects the current repository, not the original prototype.

## Phase 0 — Critical correctness and security — implemented
- [x] Fail-closed production environment validation and explicit feature flags.
- [x] Same-origin/Fetch-Metadata protection for custom state-changing APIs.
- [x] Bounded JSON request-body parsing on ANEI mutation routes.
- [x] Explicit proxy-header trust instead of blindly accepting forwarded client IPs.
- [x] Redis-backed rate limiting for sensitive operations.
- [x] Server-side RBAC/ownership/entitlement checks.
- [x] Atomic payment confirmation + entitlement + notification/audit transaction.
- [x] Payment idempotency/business-key constraints and reconciliation path.
- [x] Server-derived lesson/course completion and unique certificate issuance.
- [x] Mock payment changed from state-changing GET to development-only POST confirmation.
- [x] Private object-storage signed upload/download/media architecture.
- [x] Strict CSP/security-header baseline and document-level FR/AR direction.
- [x] Password/reset email links removed from logs; production SMTP fails closed.
- [x] SUPER_ADMIN role-change safety including final-super-admin protection.

## Phase 1 — Reproducible delivery — implemented except external lock/build gate
- [x] Versioned SQL migration runner and checksum journal.
- [x] Baseline command for databases originally created with `drizzle-kit push`.
- [x] Additive query indexes and LMS module migration.
- [x] Production-safe explicit super-admin bootstrap command.
- [x] Non-root standalone production container and liveness/readiness endpoints.
- [x] CI, Dependabot and CodeQL configuration.
- [x] Unit/security tests, DB integration hook, Playwright E2E smoke/security tests and bounded k6 profile.
- [ ] Generate and commit `package-lock.json` in a registry-connected environment.
- [ ] Execute CI end-to-end with dependency installation and browser tests.

## Phase 2 — Product depth — substantially implemented
- [x] Server-side paginated public course/resource/AVS discovery.
- [x] Course modules/chapters and module-aware curriculum/learning workspace.
- [x] Resume, previous/next lesson navigation and server-backed progress.
- [x] Account connected-provider/session management and privacy-safe data export.
- [x] Dedicated paginated admin user/order/audit screens and payment reconciliation action.
- [ ] Assessment/quiz rules if certificates must represent verified mastery.
- [ ] Branded asynchronous certificate PDF generation.
- [ ] Full entity-specific enterprise CRUD screens for every admin domain if operational volume requires them.
- [ ] User notification preferences.

## Phase 3 — Production infrastructure — deployment work
- [ ] Managed PostgreSQL with backups/PITR and tested restore.
- [ ] Private Redis with authentication/TLS appropriate to provider.
- [ ] Production S3-compatible private object storage + CDN/media policy.
- [ ] Real SMTP/provider and deliverability configuration (SPF/DKIM/DMARC at domain level).
- [ ] TLS, CDN/WAF, load balancer/reverse proxy and explicit trusted proxy configuration.
- [ ] Error tracking, metrics/tracing exporters and alerts.
- [ ] Background worker/queue for email, certificate/media processing and retryable jobs when operational load justifies it.

## Phase 4 — External provider acceptance
- [ ] Google OAuth production consent/callback/branding validation.
- [ ] Flouci official sandbox end-to-end payment/reconciliation tests.
- [ ] ClicToPay merchant technical contract + implementation + certification if selected.
- [ ] Payment reconciliation/finance operational runbook rehearsal.

## Phase 5 — AI (disabled until complete)
- [ ] Ingestion and authorization-filtered retrieval.
- [ ] LLM/embedding provider adapters, usage quotas and cost controls.
- [ ] Prompt-injection/tool/SSRF/data-exfiltration defenses.
- [ ] Privacy-safe conversation storage and retention policy.
- [ ] Evaluation dataset, quality/safety thresholds and red-team tests before enabling `ENABLE_AI`.
