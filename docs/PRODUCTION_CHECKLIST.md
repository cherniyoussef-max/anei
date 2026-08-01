# Production go-live checklist

## Code/release
- [ ] `package-lock.json` committed and `npm ci` reproducible.
- [ ] typecheck, lint, unit/security/integration/E2E tests green.
- [ ] production `npm run build && npm run start` smoke-tested.
- [ ] dependency/CodeQL/secret/container scans reviewed.

## Infrastructure
- [ ] DNS + HTTPS certificate + forced HTTPS.
- [ ] WAF/CDN/load balancer configured.
- [ ] PostgreSQL private, managed backups/PITR, restore drill complete.
- [ ] Redis private/authenticated where supported.
- [ ] object storage private; signed URL flow tested.
- [ ] SMTP production sender/domain configured.

## Security
- [ ] strong secrets in secret manager; no demo credentials.
- [ ] CSP observed in report/testing without blocked required resources.
- [ ] trusted origins exact; proxy trust matches topology.
- [ ] cookie/auth/reset/OAuth flows tested on real domain.
- [ ] IDOR/CSRF/XSS/SQLi/payment business-logic pentest retested.
- [ ] ADMIN/SUPER_ADMIN MFA strategy approved before high-risk production administration.

## Payments
- [ ] Flouci official sandbox acceptance tests complete if enabled.
- [ ] ClicToPay enabled only after official technical certification if used.
- [ ] webhooks/provider verification/idempotency/reconciliation tested.

## Product
- [ ] FR and Arabic/RTL QA at mobile/tablet/desktop widths.
- [ ] WCAG 2.2 AA audit and keyboard/screen-reader checks.
- [ ] real institutional content, contact details and partners approved.
- [ ] privacy/terms/cookie/data-retention text legally reviewed for Tunisia and target markets.

## Operations
- [ ] alerts, dashboards and on-call ownership.
- [ ] runbook/rollback tested.
- [ ] security contact and secret rotation procedure ready.
