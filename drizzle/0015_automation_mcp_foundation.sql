-- Phase 10C/10D/10E: automation + MCP foundation. Additive only. --
--
-- automation_service_credential: machine/service identities used by trusted
-- first-party automation (n8n) to call the internal automation API. Only a
-- strong keyed hash of the raw token is ever stored; the raw token is shown
-- exactly once at creation and lives in n8n's encrypted credential store.
-- Scopes are a bounded capability list (e.g. automation:knowledge:ingest);
-- an endpoint's organization/entity checks always remain the final gate.
--
-- automation_execution: business-level automation executions. It is NOT a
-- duplicate of outbox_event: the outbox remains delivery/retry
-- infrastructure, while automation_execution records the logical automation
-- request (workflow allowlist name, idempotency key, status). The outbox
-- AUTOMATION_TRIGGER payload carries only { automationExecutionId }; every
-- other fact is reloaded authoritatively by the worker/handler.
--
-- outbox_event.event_type CHECK is extended with 'AUTOMATION_TRIGGER'.

CREATE TABLE "automation_service_credential" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "token_hash" text NOT NULL,
  "organization_id" text,
  "scopes" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "expires_at" timestamptz,
  "last_used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz
);
--> statement-breakpoint
ALTER TABLE "automation_service_credential" ADD CONSTRAINT "automation_service_credential_token_hash_unique" UNIQUE ("token_hash");
--> statement-breakpoint
ALTER TABLE "automation_service_credential" ADD CONSTRAINT "automation_service_credential_status_check" CHECK ("automation_service_credential"."status" in ('ACTIVE','REVOKED'));
--> statement-breakpoint
CREATE INDEX "automation_service_credential_org_idx" ON "automation_service_credential" ("organization_id", "status");
--> statement-breakpoint

CREATE TABLE "automation_execution" (
  "id" text PRIMARY KEY,
  "organization_id" text,
  "workflow_name" text NOT NULL,
  "workflow_version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'PENDING',
  "idempotency_key" text NOT NULL,
  "requested_by_user_id" text,
  "reference_id" text,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "dispatched_at" timestamptz,
  "external_execution_id" text,
  "result_code" text,
  "safe_error" text
);
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD CONSTRAINT "automation_execution_idempotency_key_unique" UNIQUE ("idempotency_key");
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD CONSTRAINT "automation_execution_status_check" CHECK ("automation_execution"."status" in ('PENDING','DISPATCHED','SUCCEEDED','FAILED_TO_DISPATCH','WORKFLOW_FAILED'));
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD CONSTRAINT "automation_execution_attempt_nonnegative" CHECK ("automation_execution"."attempt_count" >= 0);
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD CONSTRAINT "automation_execution_workflow_version_positive" CHECK ("automation_execution"."workflow_version" > 0);
--> statement-breakpoint
CREATE INDEX "automation_execution_org_created_idx" ON "automation_execution" ("organization_id", "requested_at");
--> statement-breakpoint
CREATE INDEX "automation_execution_status_idx" ON "automation_execution" ("status");
--> statement-breakpoint

ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_event_type_check";
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_event_type_check" CHECK ("outbox_event"."event_type" in ('WHATSAPP_TEMPLATE_SEND','AUTOMATION_TRIGGER'));
--> statement-breakpoint

-- System automation user: a real user row so service-originated writes (e.g.
-- CRM notes, where author_user_id is FK-restricted to "user".id) can record a
-- stable server actor. Never logs in, never appears in UI. If this seed is ever
-- removed, FKs must be changed first (ON DELETE RESTRICT protects the row).
INSERT INTO "user" (id, name, email, email_verified, role, profile_type, locale, created_at, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111', 'ANEI Automation', 'automation@anei.local', true, 'USER', 'learner', 'fr', now(), now())
ON CONFLICT (id) DO NOTHING;