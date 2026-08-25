# Local runtime

## Requirements

- Node.js 22 (`.nvmrc` and `.node-version`)
- Docker with Compose
- repository `.env` based on `.env.example`; never commit it

Ports: app `3000`, PostgreSQL `5432`, Redis `6379`, Mailpit SMTP `1025`, Mailpit UI `8025`, optional MinIO `9000/9001`, optional n8n `5678`.

## Reliable start

```bash
nvm use
docker compose up -d postgres redis mailpit
npm run db:migrate
npm run dev
```

For a production-like local smoke test:

```bash
npm run build
npm run start:local
```

Start the worker separately when testing notifications or automation:

```bash
npm run worker:outbox
```

The worker also runs the bounded automation watchdog. Its local defaults are a
5-minute dispatch/claim SLA and 30-minute running SLA; tune only through the
`AUTOMATION_*` variables documented in `.env.example`.

MinIO and n8n are optional and require their documented secrets. Do not start the full Compose file unless those values are configured. Never run `docker compose down -v`.

## Health and LAN development

Check `http://127.0.0.1:3000/api/health`. `APP_URL`, `BETTER_AUTH_URL`, and `TRUSTED_ORIGINS` must describe the origin actually used. Add explicit LAN development hosts through `DEV_ALLOWED_ORIGINS`; this does not relax production origin checks.

## Common failures

- Wrong Node: `node --version` must report v22; Node 24 is unsupported for repository verification.
- Workspace-root warning: ensure `next.config.ts` keeps `turbopack.root` and `outputFileTracingRoot` derived from the repository process directory. A separate `/home/youssef/package-lock.json` may otherwise confuse Next; do not delete it automatically.
- Stale manifests/module-not-found after route moves: stop Next, remove only `.next`, then restart.
- Redis name conflict: inspect `docker inspect anei-redis`; an older checkout may own the explicit name. Remove only the obsolete container after confirming its Compose labels. Do not delete its named volume.
- Database/Redis unavailable: use `docker compose ps`, then check the relevant container health/logs.
- OAuth redirect errors: confirm the exact public origin and Better Auth callback URL in the provider console; this requires provider-side configuration.
