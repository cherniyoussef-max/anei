# Operations runbook

## Site down
Check load balancer/container health, `/api/live`, application logs, recent deployment and dependency status. Roll back immutable release if the failure correlates with deployment.

## DB unavailable/slow
Check `/api/health`, managed DB status, connection saturation and slow queries. Do not raise pool size blindly; total connections = pool per replica × replicas. Fail closed for writes.

## Redis unavailable
Business state remains in PostgreSQL. Restore Redis; expect degraded distributed rate-limit/cache behavior and review abuse logs.

## Payment provider down/webhook failure
Disable the affected provider feature if needed; do not mark orders paid manually from browser evidence. Reconcile provider transaction server-side and use idempotent reprocessing.

## SMTP failure
Auth flows requiring email may be affected. Fix provider/credentials, then retry queued noncritical mail. Never bypass verification globally as an emergency shortcut.

## Compromised secret
Revoke/rotate at the provider/secret manager, deploy updated value, invalidate affected sessions/tokens where applicable, review audit/access logs and document incident scope.

## Failed migration
Stop rollout, preserve DB state/logs, apply tested forward fix or restore according to migration/backup plan. Never edit an already-applied migration file; checksums intentionally detect that.
