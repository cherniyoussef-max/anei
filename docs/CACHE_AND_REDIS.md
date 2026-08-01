# Redis, caching and jobs

Redis is disposable infrastructure, never the source of truth. Current primary use is distributed rate limiting.

Future uses may include public cache and queues. Namespace keys, set explicit TTLs, cap payload sizes and avoid storing secrets. If Redis is unavailable, define per-feature behavior: business truth continues in PostgreSQL; rate-limit fallback may become process-local and should generate an operational warning.

Never shared-cache authenticated HTML/API responses across users. Cache public catalogs/news only with deliberate invalidation/revalidation.
