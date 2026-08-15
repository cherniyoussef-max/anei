-- Phase 5: Official WhatsApp Cloud API foundation.
-- Adds the WhatsApp communication-channel model: organization-scoped account
-- configuration (provider metadata only — credentials stay in env, never in
-- the database), org-scoped template metadata, durable message history, and a
-- webhook deduplication ledger. WhatsApp is a communication channel, never the
-- CRM contact, never an ANEI account, never authentication/authorization.
-- See docs/premium/ROADMAP.md Phase 5.

-- Bounded activity types extended for the WhatsApp timeline. Recreated (not
-- appended) so the constraint remains a single explicit allowlist. Delivery/
-- read events intentionally stay in message history only to avoid noise.
ALTER TABLE "crm_contact_activity" DROP CONSTRAINT "crm_contact_activity_type_check";
--> statement-breakpoint
ALTER TABLE "crm_contact_activity" ADD CONSTRAINT "crm_contact_activity_type_check" CHECK ("crm_contact_activity"."type" in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED','APPOINTMENT_CREATED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','APPOINTMENT_COMPLETED','ASSESSMENT_CREATED','ASSESSMENT_COMPLETED','ADMISSION_ACCEPTED','ADMISSION_REJECTED','WHATSAPP_TEMPLATE_SENT','WHATSAPP_MESSAGE_RECEIVED','WHATSAPP_FAILED'));
--> statement-breakpoint

-- An organization-scoped WhatsApp phone number configured on the deployment's
-- Meta business account. Only non-secret provider metadata is stored; the
-- access token/app secret/verify token live in environment configuration. A
-- phone_number_id is globally unique on Meta, so a global unique index is safe
-- and prevents two organizations from claiming the same provider number.
CREATE TABLE "whatsapp_account" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text DEFAULT 'meta' NOT NULL,
	"phone_number_id" text NOT NULL,
	"business_account_id" text NOT NULL,
	"display_phone_number" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "whatsapp_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "whatsapp_account_provider_check" CHECK ("whatsapp_account"."provider" in ('meta')),
	CONSTRAINT "whatsapp_account_status_check" CHECK ("whatsapp_account"."status" in ('ACTIVE','DISABLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_account_phone_number_unique" ON "whatsapp_account" USING btree ("phone_number_id");
--> statement-breakpoint
CREATE INDEX "whatsapp_account_org_idx" ON "whatsapp_account" USING btree ("organization_id");
--> statement-breakpoint

-- Org-scoped provider template metadata (a mirror of Meta's template catalog
-- for the org's account). This is NOT a second template-design platform — only
-- enough metadata to list, validate and display provider templates.
CREATE TABLE "whatsapp_template" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"parameter_count" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "whatsapp_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "whatsapp_template_status_check" CHECK ("whatsapp_template"."status" in ('PENDING','APPROVED','REJECTED','PAUSED','DISABLED')),
	CONSTRAINT "whatsapp_template_parameter_count_nonnegative" CHECK ("whatsapp_template"."parameter_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_template_org_name_language_unique" ON "whatsapp_template" USING btree ("organization_id","name","language");
--> statement-breakpoint
CREATE INDEX "whatsapp_template_org_idx" ON "whatsapp_template" USING btree ("organization_id");
--> statement-breakpoint

-- Durable message history. contact_id is nullable and ON DELETE SET NULL:
-- an unresolved inbound message is stored (never dropped), and archiving a
-- contact or unlinking/changing the linked user never destroys communication
-- history. provider_message_id and local_request_id are each unique when
-- present — the provider id prevents duplicate inbound/status rows, and the
-- local request id makes outbound retries idempotent.
CREATE TABLE "whatsapp_message" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" text,
	"contact_id" text,
	"direction" text NOT NULL,
	"message_type" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"provider_message_id" text,
	"local_request_id" text,
	"from_phone" text,
	"to_phone" text,
	"template_name" text,
	"template_language" text,
	"text_preview" text,
	"provider_error_code" text,
	"provider_error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "whatsapp_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "whatsapp_message_account_id_whatsapp_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_account"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "whatsapp_message_contact_id_crm_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contact"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "whatsapp_message_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "whatsapp_message_direction_check" CHECK ("whatsapp_message"."direction" in ('INBOUND','OUTBOUND')),
	CONSTRAINT "whatsapp_message_type_check" CHECK ("whatsapp_message"."message_type" in ('TEMPLATE','TEXT')),
	CONSTRAINT "whatsapp_message_status_check" CHECK ("whatsapp_message"."status" in ('QUEUED','SENT','DELIVERED','READ','FAILED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_message_provider_id_unique" ON "whatsapp_message" USING btree ("provider_message_id") WHERE "provider_message_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_message_local_request_unique" ON "whatsapp_message" USING btree ("local_request_id") WHERE "local_request_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "whatsapp_message_org_created_idx" ON "whatsapp_message" USING btree ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX "whatsapp_message_contact_created_idx" ON "whatsapp_message" USING btree ("contact_id","created_at");
--> statement-breakpoint
CREATE INDEX "whatsapp_message_account_idx" ON "whatsapp_message" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "whatsapp_message_direction_status_idx" ON "whatsapp_message" USING btree ("direction","status");
--> statement-breakpoint

-- Webhook deduplication ledger. A stable, provider-derived key per event; the
-- unique index makes a Meta retry/replay of the same event a no-op at the DB
-- level. The dedup row and its side effects commit in the same transaction.
CREATE TABLE "whatsapp_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"stable_key" text NOT NULL,
	"event_type" text NOT NULL,
	"organization_id" text,
	"received_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "whatsapp_webhook_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "whatsapp_webhook_event_type_check" CHECK ("whatsapp_webhook_event"."event_type" in ('INBOUND_MESSAGE','STATUS_UPDATE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_webhook_event_stable_key_unique" ON "whatsapp_webhook_event" USING btree ("stable_key");
--> statement-breakpoint
CREATE INDEX "whatsapp_webhook_event_org_received_idx" ON "whatsapp_webhook_event" USING btree ("organization_id","received_at");