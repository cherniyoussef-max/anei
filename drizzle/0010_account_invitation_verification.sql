-- Phase 6: Account invitation + WhatsApp/phone verification + CRM contact →
-- ANEI user linking.
--
-- An accepted prospect becomes an ANEI user through a strictly-gated flow:
--   invite → WhatsApp invitation link → phone (OTP) verification → the
--   prospect logs in or registers via Better Auth → authenticated claim →
--   crm_contact.linkedUserId set → STUDENT persona ensured → CONSUMED.
--
-- Security invariants encoded at the storage layer (see docs/premium/
-- ROADMAP.md Phase 6):
--   * Phone verification is NOT authentication and never creates an account.
--     The invitation token is a one-time bearer credential for the VERIFY step;
--     the final CLAIM step requires a real Better Auth session.
--   * Only a SHA-256 digest of the invitation token is stored (never the raw
--     token) and only a keyed HMAC-SHA256 digest of the OTP is stored (never
--     the raw code, never a plain hash). OTP codes are keyed with a server
--     secret that lives in env, not in the database.
--   * At most one ACTIVE (usable) invitation may exist for a contact and at
--     most one ACTIVE verification challenge may exist per invitation — both
--     enforced by partial unique indexes, making a race/duplicate a DB-level
--     impossibility.
--   * Organization scoping uses the same (id, organization_id) composite FK
--     pattern as Phase 4: contact/admission references are cross-org-proof.
--   * intended_persona is locked to STUDENT at the DB CHECK level — an
--     invitation can never grant TEACHER/AVS/SPECIALIST/ORGANIZATION or any
--     admin role.
--   * CRM activity is bounded (recreated allowlist below). No raw tokens,
--     codes or secrets are ever written to audit/activity metadata.
-- See docs/premium/DATA_MODEL.md §6 and docs/premium/ROADMAP.md Phase 6.

-- Bounded activity types extended for the invitation/verification timeline.
-- Recreated (not appended) so the constraint remains a single explicit
-- allowlist, matching the Phase 4/5 pattern.
ALTER TABLE "crm_contact_activity" DROP CONSTRAINT "crm_contact_activity_type_check";
--> statement-breakpoint
ALTER TABLE "crm_contact_activity" ADD CONSTRAINT "crm_contact_activity_type_check" CHECK ("crm_contact_activity"."type" in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED','APPOINTMENT_CREATED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','APPOINTMENT_COMPLETED','ASSESSMENT_CREATED','ASSESSMENT_COMPLETED','ADMISSION_ACCEPTED','ADMISSION_REJECTED','WHATSAPP_TEMPLATE_SENT','WHATSAPP_MESSAGE_RECEIVED','WHATSAPP_FAILED','ACCOUNT_INVITATION_SENT','PHONE_VERIFIED','ACCOUNT_LINKED','ACCOUNT_INVITATION_REVOKED'));
--> statement-breakpoint

-- (id, organization_id) unique on admission enables the composite FK used by
-- the account_invitation table below (an invitation in org A can never
-- reference an admission in org B at the DB level). Added here because nothing
-- previously referenced admission.
CREATE UNIQUE INDEX "admission_id_org_unique" ON "admission" USING btree ("id","organization_id");
--> statement-breakpoint

-- A single account invitation for one CRM contact. `destination_phone` is a
-- normalized snapshot of the number the invitation and every OTP is sent to —
-- the client never submits a destination; the server always resolves it from
-- this snapshot. `token_hash` is null until the first send (a PENDING_SEND
-- invitation carries no usable token); a resend rotates the token (version++,
-- new hash). `send_attempt_count` bounds both the initial send and resends.
CREATE TABLE "account_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"admission_id" text,
	"intended_persona" text DEFAULT 'STUDENT' NOT NULL,
	"status" text DEFAULT 'PENDING_SEND' NOT NULL,
	"destination_phone" text NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"token_hash" text,
	"token_version" integer DEFAULT 0 NOT NULL,
	"token_expires_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"send_attempt_count" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "account_invitation_contact_org_fk" FOREIGN KEY ("contact_id","organization_id") REFERENCES "public"."crm_contact"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "account_invitation_admission_org_fk" FOREIGN KEY ("admission_id","organization_id") REFERENCES "public"."admission"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "account_invitation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "account_invitation_intended_persona_check" CHECK ("account_invitation"."intended_persona" in ('STUDENT')),
	CONSTRAINT "account_invitation_status_check" CHECK ("account_invitation"."status" in ('PENDING_SEND','SENT','VERIFIED','CONSUMED','REVOKED','EXPIRED')),
	CONSTRAINT "account_invitation_locale_check" CHECK ("account_invitation"."locale" in ('fr','ar')),
	CONSTRAINT "account_invitation_send_attempt_count_nonnegative" CHECK ("account_invitation"."send_attempt_count" >= 0),
	CONSTRAINT "account_invitation_token_version_nonnegative" CHECK ("account_invitation"."token_version" >= 0)
);
--> statement-breakpoint
-- At most one live (usable) invitation per contact. A REVOKED/CONSUMED/EXPIRED
-- invitation may be superseded by a fresh one, so the constraint is partial.
CREATE UNIQUE INDEX "account_invitation_contact_live_unique" ON "account_invitation" USING btree ("contact_id") WHERE "status" IN ('PENDING_SEND','SENT','VERIFIED');
--> statement-breakpoint
-- The token digest is unique when present — a digest collision is the only way
-- two rows could share a token, and that is not a retry, it is a collision.
CREATE UNIQUE INDEX "account_invitation_token_hash_unique" ON "account_invitation" USING btree ("token_hash") WHERE "token_hash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "account_invitation_org_created_idx" ON "account_invitation" USING btree ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX "account_invitation_contact_idx" ON "account_invitation" USING btree ("contact_id");
--> statement-breakpoint
CREATE INDEX "account_invitation_admission_idx" ON "account_invitation" USING btree ("admission_id");
--> statement-breakpoint

-- A phone-verification attempt for an invitation. `code_hash` is a keyed
-- HMAC-SHA256 digest (server secret derived from BETTER_AUTH_SECRET, never in
-- the DB). A request for a new code supersedes the active challenge; a
-- replayed/expired code can never resurrect a superseded challenge. Attempt
-- budget (max_attempts) and short TTL are enforced here and in the service.
CREATE TABLE "account_verification_challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_verification_challenge_invitation_id_account_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."account_invitation"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "account_verification_challenge_status_check" CHECK ("account_verification_challenge"."status" in ('ACTIVE','VERIFIED','LOCKED','SUPERSEDED','EXPIRED')),
	CONSTRAINT "account_verification_challenge_attempt_count_nonnegative" CHECK ("account_verification_challenge"."attempt_count" >= 0),
	CONSTRAINT "account_verification_challenge_max_attempts_bounded" CHECK ("account_verification_challenge"."max_attempts" >= 1 AND "account_verification_challenge"."max_attempts" <= 20)
);
--> statement-breakpoint
-- At most one ACTIVE challenge per invitation — requesting a new code must
-- supersede (not stack with) the current one, DB-enforced.
CREATE UNIQUE INDEX "account_verification_challenge_invitation_active_unique" ON "account_verification_challenge" USING btree ("invitation_id") WHERE "status" = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX "account_verification_challenge_invitation_idx" ON "account_verification_challenge" USING btree ("invitation_id");
--> statement-breakpoint

-- Append-only invitation lifecycle history. No updates, no deletes — the full
-- send/resend/verify/revoke/consume trail lives here for auditability.
-- Metadata is deliberately bounded: no raw tokens, no OTP codes, no secrets.
CREATE TABLE "account_invitation_event" (
	"id" text PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_invitation_event_invitation_id_account_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."account_invitation"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "account_invitation_event_type_check" CHECK ("account_invitation_event"."event_type" in ('INVITATION_CREATED','INVITATION_SENT','INVITATION_SEND_FAILED','OTP_SENT','PHONE_VERIFIED','INVITATION_REVOKED','INVITATION_CONSUMED','INVITATION_EXPIRED'))
);
--> statement-breakpoint
CREATE INDEX "account_invitation_event_invitation_created_idx" ON "account_invitation_event" USING btree ("invitation_id","created_at");