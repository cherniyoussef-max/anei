# Deployment

## Recommended production topology
CDN/WAF/TLS -> load balancer -> stateless Next.js replicas -> PgBouncer/managed PostgreSQL; private Redis; private S3-compatible object storage/CDN; SMTP; external auth/payment providers.

PostgreSQL and Redis must not be public. Development Compose binds those ports to `127.0.0.1` only and is not a production stack.

## Release sequence
1. CI green with committed lockfile.
2. Build immutable container.
3. Backup DB and apply reviewed migrations.
4. Deploy application using secret manager values.
5. Check `/api/live` and `/api/health`.
6. Run smoke tests.
7. Monitor errors/payment/auth metrics.

## Configuration
Production startup intentionally rejects HTTP auth URLs, default auth/DB credentials, mock payment and local protected storage.

## TLS/proxy
Terminate TLS only at controlled infrastructure. Enable `TRUST_PROXY_HEADERS=true` only if direct client access to the app is blocked and the trusted proxy overwrites forwarding headers.
