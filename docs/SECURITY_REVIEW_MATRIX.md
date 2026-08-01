# Security review matrix

Status is evidence-based for this repository only. Deployment controls still need staging/production verification.

| Control area | Implemented? | Automated evidence | Remaining risk/action |
|---|---:|---|---|
| Server authentication | Yes | Auth-dependent route/E2E baseline | Real Google/email provider acceptance required. |
| RBAC/privileged mutations | Yes baseline | Anonymous admin E2E + server checks | Expand authenticated cross-role integration/E2E suite. |
| IDOR/entitlements | Yes baseline | Server entitlement services | Add two-user staging tests for every protected object type. |
| CSRF/origin | Yes custom APIs | Foreign-Origin E2E | Validate reverse proxy/trusted origins in staging. |
| Open redirects | Yes | Unit/security regression | Re-test every new auth/return path. |
| SQL injection | Parameterized baseline | Source policy + integration query model | Continue forbidding user-controlled raw SQL; DAST in staging. |
| XSS | React escaping/no raw HTML baseline | Source policy | Sanitize if rich HTML is introduced; run browser payload tests. |
| CSP/clickjacking | Yes baseline | Header E2E | Verify all real provider/CDN origins without weakening policy. |
| Request-size abuse | Yes custom JSON | Unit test | Add CDN/proxy global body limits for upload/API tiers. |
| Rate limiting | Yes sensitive routes | Code/config review | Tune thresholds and distributed Redis behavior under staging load. |
| Payment integrity | Yes architecture | DB uniqueness/services | Flouci sandbox replay/failure/reconciliation acceptance required. |
| Protected files | Yes architecture | Entitlement + signed URL path | Configure bucket policy/CORS/IAM and malware/media pipeline. |
| Database invariants | Yes | Versioned constraints/integration hook | Run migration suite from empty DB in CI/staging. |
| Secrets/config fail-closed | Yes | env validation | Use real secret manager/rotation process. |
| Supply chain | Configured | CI/CodeQL/Dependabot config | Commit lockfile; run npm/OSV/container/SBOM scans. |
| Logging/audit | Baseline | Code review | Connect centralized log/error/alert backend. |
| Backup/recovery | Documented | None in repo | Perform and record real restore drill. |
| Admin MFA | No | Feature is production-blocked | Implement supported MFA + recovery before mandate. |
| AI security | Not production-enabled | Production flag blocks enablement | Build retrieval authorization, quotas, red-team/evals first. |
