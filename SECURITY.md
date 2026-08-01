# Security architecture

## Trust model
The browser is untrusted. UI hiding, client validation, route visibility, submitted prices/progress/roles and object identifiers are never authorization evidence. PostgreSQL + authenticated server-side business rules are authoritative.

## Implemented controls
### Authentication / sessions
- Better Auth email/password and optional Google OAuth.
- secure production URL/secret/origin requirements.
- email verification/reset; reset revokes sessions according to auth configuration.
- connected-account/session UI and server-side session revocation.
- no reset/verification token logging.

### Authorization / IDOR
- server RBAC for admin/SUPER_ADMIN mutations;
- ownership/entitlement checks for course learning/resources/webinars;
- privileged role changes derive actor role from session, not request JSON;
- final `SUPER_ADMIN` cannot be silently demoted by the role endpoint;
- admin audit events for sensitive operations.

### Request protection
- same-origin + Fetch Metadata guard for custom state-changing browser routes;
- strict relative redirect allowlist;
- bounded JSON request-body reader;
- Zod validation at server boundaries;
- distributed rate limits with explicit proxy-header trust;
- state-changing application operations are POST/PATCH/etc., not ordinary GET side effects.

### Injection / browser security
- Drizzle parameterized data access; `sql.raw(userInput)` is forbidden by policy/audit;
- no `dangerouslySetInnerHTML` in application source baseline;
- per-request CSP nonce and restrictive CSP;
- HSTS only in production plus nosniff/referrer/permissions/frame/opener policies.

### Payments / commerce
- server resolves item price/currency;
- server-to-server provider verification;
- amount/reference validation;
- payment status + entitlement + notification/audit in one DB transaction;
- idempotent uniqueness keys and admin reconciliation that does not manually grant an unpaid order;
- provider response persistence minimized to operational fields rather than wholesale sensitive payloads;
- mock provider forbidden in production.

### Data / media / operations
- PostgreSQL integrity/unique constraints;
- checksum/versioned migrations;
- private S3-compatible storage and short-lived signed URLs after authorization;
- allowlisted upload MIME/type/size baseline and random storage keys;
- secrets/env validation and production fail-closed flags;
- non-root production image; local DB/Redis/Mailpit bound to loopback;
- structured log redaction and audit history;
- CI/SAST/dependency-update configuration.

## Controls still required at deployment
- WAF/CDN/TLS/reverse proxy configuration and validation;
- managed DB/Redis/storage IAM/network isolation;
- secret manager and rotation procedures;
- malware scanning/media processing where untrusted upload volume requires it;
- monitoring/error tracking/alerts;
- dependency/SBOM/container scans in the final CI environment;
- external provider acceptance tests;
- authorized staging pentest and remediation.

No application can be declared “100% secure”. The goal is layered controls, reproducible evidence and documented residual risk.
