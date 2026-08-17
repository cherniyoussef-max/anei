-- Phase 9: transactional outbox + worker. Additive only. --
-- outbox_event: written in the same PostgreSQL transaction as the domain
-- mutation it represents. status/attempts/availableAt/lockedAt drive the
-- worker's SELECT ... FOR UPDATE SKIP LOCKED claim + stale-lease recovery.
-- eventType is bounded to an explicit allowlist (extend the CHECK, never
-- accept an arbitrary handler name). See docs/premium/PHASE9_HANDOFF.md.
--
-- whatsapp_message.body_parameters / body_parameters_encrypted: template
-- send parameters moved out of the request path so the worker can reload
-- them later. Non-secret parameters (e.g. an invitation URL) are plaintext;
-- secret parameters (the OTP digit string) are AES-256-GCM ciphertext,
-- never plaintext, and are scrubbed back to null once delivery is attempted.

CREATE TABLE "outbox_event" (
  "id" text PRIMARY KEY,
  "organization_id" text,
  "aggregate_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "payload_version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'PENDING',
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 8,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "locked_at" timestamptz,
  "locked_by" text,
  "processed_at" timestamptz,
  "last_error_code" text,
  "last_error_message" text,
  "idempotency_key" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_status_check" CHECK ("outbox_event"."status" in ('PENDING','PROCESSING','SUCCEEDED','FAILED'));
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_event_type_check" CHECK ("outbox_event"."event_type" in ('WHATSAPP_TEMPLATE_SEND'));
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_attempts_nonnegative" CHECK ("outbox_event"."attempts" >= 0);
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_max_attempts_positive" CHECK ("outbox_event"."max_attempts" > 0);
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_payload_version_positive" CHECK ("outbox_event"."payload_version" > 0);
--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_event_idempotency_key_unique" ON "outbox_event" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "outbox_event_claim_idx" ON "outbox_event" ("status", "available_at");
--> statement-breakpoint
CREATE INDEX "outbox_event_processing_idx" ON "outbox_event" ("status", "locked_at");
--> statement-breakpoint
CREATE INDEX "outbox_event_org_created_idx" ON "outbox_event" ("organization_id", "created_at");
--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD COLUMN "body_parameters" jsonb;
--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD COLUMN "body_parameters_encrypted" jsonb;
