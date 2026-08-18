# Phase 10C–10E Post-Repair Handoff

## What is now true

- ANEI -> n8n dispatch auth is real and native: webhook nodes use `authentication=headerAuth` and require `Authorization: Bearer <ANEI_N8N_DISPATCH_TOKEN>`.
- n8n -> ANEI internal API uses a different secret: `N8N_ANEI_SERVICE_TOKEN`.
- Secrets are directionally split and validated in app env (`ANEI_N8N_DISPATCH_TOKEN !== N8N_ANEI_SERVICE_TOKEN`).
- Outbox semantics remain at-least-once; duplicate webhook delivery is handled by ANEI atomic claim.

## Automation execution model

`automation_execution` is authoritative state:

- `PENDING -> DISPATCHED -> RUNNING -> SUCCEEDED|FAILED|WORKFLOW_FAILED`
- `PENDING -> FAILED_TO_DISPATCH`

Claim endpoint:

- `POST /api/internal/automation/executions/claim`
- Atomic conditional update (`status IN ('PENDING','DISPATCHED') -> RUNNING`)
- Duplicate deliveries return `claimed: false` and must exit without side effects

Status callback endpoint:

- `POST /api/internal/automation/executions/status`
- Finalizes `RUNNING -> terminal`
- Idempotent duplicate callback on same terminal state
- Monotonic (terminal state never regresses)

## Workflow behavior

All four webhook workflows now:

1. Authenticate webhook request natively.
2. Claim execution before side effects.
3. Use stable request ids based on `automationExecutionId`.
4. Report final execution status to ANEI.

`automation.onboarding_followup` now responds immediately (`onReceived`) before `Wait 1 day`, then re-queries ANEI eligibility.

## MCP actor-type exposure

MCP allowlist is actor-aware:

- Browser session actor: read + approved write/proposal tools (including `create_appointment` proposal flow).
- Service credential actor: read-only tools.
- Service actor no longer advertises or can execute `BUSINESS_WRITE` tools.

## Rate limiting

Service-token routes now enforce two layers:

- pre-auth fingerprint bucket
- post-auth credential bucket

Applied in MCP auth and internal automation auth.

## n8n hardening

`NODES_EXCLUDE` is now encoded as JSON array (n8n 2.36.0-compatible parsing path).
Dangerous/system nodes (including `executeCommand`) are explicitly excluded.

## Dependency pin

`@modelcontextprotocol/sdk` is intentionally pinned to `1.30.0` for this milestone.
Future v2 migration remains tracked technical debt.

## Known accepted debt

- No automatic n8n credential provisioning script; credential binding remains operator-driven after workflow import.
- Distributed exactly-once is not claimed for third-party side effects outside ANEI control.
