# N8N Setup — ANEI Automation Engine (Phase 10E)

n8n runs as an internal automation engine. It must not access ANEI DB credentials,
and it must not be publicly reachable.

## 1) Two-direction secrets (must be distinct)

- `ANEI_N8N_DISPATCH_TOKEN` (ANEI -> n8n webhook dispatch auth)
- `N8N_ANEI_SERVICE_TOKEN` (n8n -> ANEI internal API Bearer token)

Never reuse the same value for both directions.

## 2) Required env

ANEI app/worker:

- `N8N_WEBHOOK_BASE_URL` (example `http://127.0.0.1:5678`)
- `ANEI_N8N_DISPATCH_TOKEN`
- `N8N_TIMEOUT_MS` (default `8000`)

Docker compose:

- `N8N_ENCRYPTION_KEY` (required)
- `N8N_POSTGRES_PASSWORD` (optional dev override)

n8n environment variables:

- `ANEI_INTERNAL_BASE_URL` (example `http://host.docker.internal:3000`)
- `N8N_ANEI_SERVICE_TOKEN`
- template ids (`APPOINTMENT_REMINDER_TEMPLATE_ID`, `ONBOARDING_FOLLOWUP_TEMPLATE_ID`, `TEACHER_NOTIFICATION_TEMPLATE_ID`)

## 3) Start safely

```bash
docker compose up -d n8n-postgres n8n
```

Never run `docker compose down -v`.

## 4) Import and bind workflows

Import sanitized files from `n8n/workflows/*.json`.

After import, bind webhook auth credentials:

1. Open each Webhook node.
2. Set Authentication to Header Auth.
3. Bind an `httpHeaderAuth` credential with:
   - Header name: `Authorization`
   - Header value: `Bearer <ANEI_N8N_DISPATCH_TOKEN>`

The workflow must reject missing/wrong Authorization and only start on correct token.

## 5) Claim-first workflow rule

Each webhook workflow must call:

- `POST /api/internal/automation/executions/claim`

before any business side effect.

If claim returns `claimed: false`, workflow exits with no side effect.

## 6) Onboarding workflow rule

`automation.onboarding_followup` responds immediately (`responseMode=onReceived`) and performs delayed work after `Wait`.
It must not keep webhook HTTP response open across the wait window.

## 7) n8n hardening

`docker-compose.yml` uses JSON-array `NODES_EXCLUDE` and excludes dangerous nodes (including `n8n-nodes-base.executeCommand`).
Run `n8n audit` after boot and review findings by severity.
