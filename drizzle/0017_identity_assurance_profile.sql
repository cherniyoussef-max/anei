-- Phase 11: identity assurance, onboarding profile, OTP and auth observability.

CREATE TABLE IF NOT EXISTS "user_profile" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "birth_date" timestamptz,
  "birth_year" integer,
  "phone_number" text,
  "phone_verified_at" timestamptz,
  "country" text,
  "governorate" text,
  "city" text,
  "preferred_locale" text NOT NULL DEFAULT 'fr',
  "requested_persona" text,
  "education_level" text,
  "institution_name" text,
  "onboarding_completed_at" timestamptz,
  "terms_accepted_at" timestamptz,
  "privacy_accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_profile_locale_check" CHECK ("preferred_locale" in ('fr','ar')),
  CONSTRAINT "user_profile_requested_persona_check" CHECK (
    "requested_persona" is null or "requested_persona" in ('STUDENT','AVS','PARENT','TEACHER','SPECIALIST','ORGANIZATION')
  ),
  CONSTRAINT "user_profile_birth_year_bounds_check" CHECK (
    "birth_year" is null or ("birth_year" >= 1900 and "birth_year" <= 2100)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_profile_user_unique" ON "user_profile"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profile_phone_idx" ON "user_profile"("phone_number");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_session_assurance" (
  "id" text PRIMARY KEY,
  "session_id" text NOT NULL REFERENCES "session"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "method" text NOT NULL,
  "verified_at" timestamptz NOT NULL,
  "completed_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "auth_session_assurance_method_check" CHECK ("method" in ('EMAIL','WHATSAPP'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_session_assurance_session_unique" ON "auth_session_assurance"("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_session_assurance_user_idx" ON "auth_session_assurance"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_session_assurance_expires_idx" ON "auth_session_assurance"("expires_at");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_verification_challenge" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "session_id" text REFERENCES "session"("id") ON DELETE cascade,
  "purpose" text NOT NULL,
  "channel" text NOT NULL,
  "destination" text NOT NULL,
  "destination_masked" text NOT NULL,
  "code_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "resend_available_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "verified_at" timestamptz,
  "superseded_at" timestamptz,
  "delivery_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "auth_verification_challenge_purpose_check" CHECK (
    "purpose" in ('LOGIN','PASSWORD_RESET','ACCOUNT_RECOVERY','VERIFY_EMAIL','VERIFY_PHONE','CHANGE_EMAIL','CHANGE_PHONE','SENSITIVE_ACTION')
  ),
  CONSTRAINT "auth_verification_challenge_channel_check" CHECK ("channel" in ('EMAIL','WHATSAPP')),
  CONSTRAINT "auth_verification_challenge_status_check" CHECK (
    "status" in ('ACTIVE','VERIFIED','LOCKED','SUPERSEDED','EXPIRED','CANCELLED')
  ),
  CONSTRAINT "auth_verification_challenge_attempt_nonnegative" CHECK ("attempt_count" >= 0),
  CONSTRAINT "auth_verification_challenge_max_attempt_positive" CHECK ("max_attempts" > 0),
  CONSTRAINT "auth_verification_challenge_delivery_version_positive" CHECK ("delivery_version" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_verification_challenge_user_idx" ON "auth_verification_challenge"("user_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_verification_challenge_session_idx" ON "auth_verification_challenge"("session_id", "purpose", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_verification_challenge_destination_idx" ON "auth_verification_challenge"("destination", "created_at");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_reset_authorization" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "challenge_id" text NOT NULL REFERENCES "auth_verification_challenge"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "auth_reset_authorization_status_check" CHECK ("status" in ('ACTIVE','CONSUMED','EXPIRED','REVOKED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_reset_authorization_token_hash_unique" ON "auth_reset_authorization"("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_reset_authorization_active_user_unique"
  ON "auth_reset_authorization"("user_id") WHERE "status" = 'ACTIVE';

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_event" (
  "id" text PRIMARY KEY,
  "request_id" text NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "provider" text,
  "channel" text,
  "purpose" text,
  "event_type" text NOT NULL,
  "safe_reason_code" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "auth_event_channel_check" CHECK ("channel" is null or "channel" in ('EMAIL','WHATSAPP')),
  CONSTRAINT "auth_event_purpose_check" CHECK (
    "purpose" is null or "purpose" in ('LOGIN','PASSWORD_RESET','ACCOUNT_RECOVERY','VERIFY_EMAIL','VERIFY_PHONE','CHANGE_EMAIL','CHANGE_PHONE','SENSITIVE_ACTION')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_event_created_idx" ON "auth_event"("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_event_user_created_idx" ON "auth_event"("user_id", "created_at");
