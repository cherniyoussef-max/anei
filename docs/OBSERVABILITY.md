# Observability

## Endpoints
- `/api/live`: process liveness; no dependency checks.
- `/api/health`: readiness-oriented DB/Redis/capability status; does not expose credentials.

## Logging
Use structured logs with request/action/outcome/duration where useful. Redact passwords, tokens, cookies, authorization headers, OAuth credentials and provider payload secrets.

## Production integration
Add an OpenTelemetry-compatible exporter and error tracker. Monitor HTTP p50/p95/p99, 5xx rate, DB latency/pool pressure, Redis failures, login failures, checkout/verification failures, SMTP/queue failures and storage errors. Alerts need actionable thresholds and runbook links.
