-- Phase 6: account invitation + WhatsApp/phone verification + CRM contact ->
-- ANEI user linking. An invitation is a durable, revocable, one-time-
-- consumable credential -- never an account, never a session, never
-- authentication by itself. Phone verification (OTP) proves control of the
-- invited phone at that moment; it never authenticates a Better Auth user,
-- never selects an existing account by phone, and account
-- provisioning/login remains entirely Better Auth-owned.
-- See docs/premium/ROADMAP.md Phase 6.

-- (id, organization_id) unique on admission enables the composite invitation
-- FK below, mirroring the same pattern crm_contact/appointment/assessment
-- already use -- an invitation can never reference an admission from a
-- foreign organization at the DB level.
CREATE UNIQUE INDEX "admission_id_org_unique" ON "admission" USING btree ("id","organization_id");
--> statement-breakpoint

-- Bounded activity types extended for the Phase 6 timeline. Recreated (not
-- appended) so the constraint remains a single explicit allowlist, matching
-- the Phase 5 migration convention. OTP send/verify attempts intentionally
-- stay in invitation history only, to avoid CRM timeline noise.
ALTER TABLE "crm_contact_activity" DROP CONSTRAINT "crm_contact_activity_type_check";
--> statement-breakpoint
ALTER TABLE "crm_contact_activity" ADD CONSTRAINT "crm_contact_activity_type_check" CHECK ("crm_contact_activity"."type" in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED','APPOINTMENT_CREATED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','APPOINTMENT_COMPLETED','ASSESSMENT_CREATED','ASSESSMENT_COMPLETED','ADMISSION_ACCEPTED','ADMISSION_REJECTED','WHATSAPP_TEMPLATE_SENT','WHATSAPP_MESSAGE_RECEIVED','WHATSAPP_FAILED','ACCOUNT_INVITATION_SENT','PHONE_VERIFIED','ACCOUNT_LINKED','ACCOUNT_INVITATION_REVOKED'));
--> statement-breakpoint

-- Account invitation: one durable row per contact's active onboarding
-- attempt. `token_hash` stores only an HMAC digest of the invitation
-- secret -- the raw token is never persisted. `destination_phone` is a
-- SNAPSHOT of the normalized phone at creation time so a later CRM phone
-- edit never silently redirects an existing invitation's OTP destination.
CREATE TABLE "account_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"admission_id" text NOT NULL,
	"intended_persona" text DEFAULT 'STUDENT' NOT NULL,
	"status" text DEFAULT 'PENDING_SEND' NOT NULL,
	"destination_phone" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "account_invitation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "account_invitation_contact_org_fk" FOREIGN KEY ("contact_id","organization_id") REFERENCES "public"."crm_contact"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "account_invitation_admission_org_fk" FOREIGN KEY ("admission_id","organization_id") REFERENCES "public"."admission"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "account_invitation_status_check" CHECK ("account_invitation"."status" in ('PENDING_SEND','SENT','SEND_FAILED','VERIFIED','CONSUMED','REVOKED','EXPIRED')),
	CONSTRAINT "account_invitation_persona_check" CHECK ("account_invitation"."intended_persona" in ('STUDENT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_invitation_token_hash_unique" ON "account_invitation" USING btree ("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_invitation_contact_active_unique" ON "account_invitation" USING btree ("contact_id") WHERE "account_invitation"."status" in ('PENDING_SEND','SENT','VERIFIED');
--> statement-breakpoint
CREATE INDEX "account_invitation_org_created_idx" ON "account_invitation" USING btree ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX "account_invitation_contact_status_idx" ON "account_invitation" USING btree ("contact_id","status");
--> statement-breakpoint
CREATE INDEX "account_invitation_admission_idx" ON "account_invitation" USING btree ("admission_id");
--> statement-breakpoint

-- Verification challenge: at most one ACTIVE row per invitation
-- (DB-authoritative via the partial unique index, not application memory).
-- `code_hash` stores only a keyed HMAC digest of the OTP -- the raw OTP is
-- never persisted.
CREATE TABLE "account_verification_challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_verification_challenge_invitation_id_account_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."account_invitation"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "account_verification_challenge_status_check" CHECK ("account_verification_challenge"."status" in ('ACTIVE','VERIFIED','LOCKED','SUPERSEDED','EXPIRED')),
	CONSTRAINT "account_verification_challenge_attempt_nonnegative" CHECK ("account_verification_challenge"."attempt_count" >= 0),
	CONSTRAINT "account_verification_challenge_max_attempts_positive" CHECK ("account_verification_challenge"."max_attempts" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_verification_challenge_active_unique" ON "account_verification_challenge" USING btree ("invitation_id") WHERE "account_verification_challenge"."status" = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX "account_verification_challenge_invitation_idx" ON "account_verification_challenge" USING btree ("invitation_id","status");
--> statement-breakpoint

-- Append-only invitation lifecycle history. Never stores OTP/token/secret
-- values in metadata.
CREATE TABLE "account_invitation_event" (
	"id" text PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL,
	"actor_user_id" text,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_invitation_event_invitation_id_account_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."account_invitation"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "account_invitation_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "account_invitation_event_type_check" CHECK ("account_invitation_event"."event_type" in ('INVITATION_CREATED','INVITATION_SENT','INVITATION_RESENT','INVITATION_SEND_FAILED','OTP_SENT','PHONE_VERIFIED','INVITATION_REVOKED','INVITATION_CONSUMED'))
);
--> statement-breakpoint
CREATE INDEX "account_invitation_event_invitation_idx" ON "account_invitation_event" USING btree ("invitation_id","created_at");
