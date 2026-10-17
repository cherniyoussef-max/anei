-- Migration: 0045_practitioner_ecosystem_and_hybrid_workflows
-- Description: Supports strict separation of AVS and Specialists, Academic Promotion Pipeline, Hybrid Appointments (0% on-site, 15% online visio), Webinars categories and Course Studio qualification.

-- 1. Extend avs_profiles for dual directory (AVS vs SPECIALIST), contact phone, and category fields
ALTER TABLE "avs_profiles"
  ADD COLUMN IF NOT EXISTS "directory_type" text NOT NULL DEFAULT 'AVS',
  ADD COLUMN IF NOT EXISTS "category" text,
  ADD COLUMN IF NOT EXISTS "contact_phone" text,
  ADD COLUMN IF NOT EXISTS "show_phone_publicly" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "whatsapp_phone" text,
  ADD COLUMN IF NOT EXISTS "workplace_name" text,
  ADD COLUMN IF NOT EXISTS "workplace_address" text,
  ADD COLUMN IF NOT EXISTS "license_or_order_number" text,
  ADD COLUMN IF NOT EXISTS "university_degree" text,
  ADD COLUMN IF NOT EXISTS "consultation_duration_minutes" integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS "in_person_price_millimes" integer NOT NULL DEFAULT 40000,
  ADD COLUMN IF NOT EXISTS "online_visio_price_millimes" integer NOT NULL DEFAULT 35000,
  ADD COLUMN IF NOT EXISTS "availability_regime" text NOT NULL DEFAULT 'FULL_TIME',
  ADD COLUMN IF NOT EXISTS "category_details" jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE "avs_profiles" ADD CONSTRAINT "avs_directory_type_check" CHECK ("directory_type" IN ('AVS', 'SPECIALIST'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "avs_directory_type_idx" ON "avs_profiles" ("directory_type");
CREATE INDEX IF NOT EXISTS "avs_category_idx" ON "avs_profiles" ("category");

-- 2. Extend user table for academic pipeline status
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "professional_post_status" text NOT NULL DEFAULT 'LEARNER_ONLY';

DO $$ BEGIN
  ALTER TABLE "user" ADD CONSTRAINT "user_professional_post_status_check" CHECK ("professional_post_status" IN ('LEARNER_ONLY', 'CANDIDATE_UNDER_REVIEW', 'APPROVED_AVS', 'APPROVED_SPECIALIST'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create practitioner_promotions table
CREATE TABLE IF NOT EXISTS "practitioner_promotions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "target_directory_type" text NOT NULL,
  "target_category" text NOT NULL,
  "professional_post_status" text NOT NULL DEFAULT 'CANDIDATE_UNDER_REVIEW',
  "interview_status" text NOT NULL DEFAULT 'NOT_SCHEDULED',
  "interview_notes" text,
  "interview_score" integer,
  "interview_scheduled_at" timestamptz,
  "qualifying_course_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "promoted_by_admin_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "promoted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "practitioner_promotions_type_check" CHECK ("target_directory_type" IN ('AVS', 'SPECIALIST')),
  CONSTRAINT "practitioner_promotions_post_status_check" CHECK ("professional_post_status" IN ('LEARNER_ONLY', 'CANDIDATE_UNDER_REVIEW', 'APPROVED_AVS', 'APPROVED_SPECIALIST')),
  CONSTRAINT "practitioner_promotions_interview_status_check" CHECK ("interview_status" IN ('NOT_SCHEDULED', 'SCHEDULED', 'PASSED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS "practitioner_promotions_user_idx" ON "practitioner_promotions" ("user_id");
CREATE INDEX IF NOT EXISTS "practitioner_promotions_status_idx" ON "practitioner_promotions" ("professional_post_status");
CREATE INDEX IF NOT EXISTS "practitioner_promotions_type_idx" ON "practitioner_promotions" ("target_directory_type");

-- 4. Extend avs_booking_requests for Hybrid Workflow & Escrow/Pay-on-site
ALTER TABLE "avs_booking_requests"
  ADD COLUMN IF NOT EXISTS "payment_mode" text NOT NULL DEFAULT 'PLATFORM_ESCROW',
  ADD COLUMN IF NOT EXISTS "platform_commission_percent" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "net_practitioner_payout_millimes" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "live_session_id" text REFERENCES "live_sessions"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "practitioner_notes" text,
  ADD COLUMN IF NOT EXISTS "escrow_status" text NOT NULL DEFAULT 'HELD_IN_ESCROW';

-- Update meetingType check to allow ONLINE_VISIO
ALTER TABLE "avs_booking_requests" DROP CONSTRAINT IF EXISTS "avs_booking_type_check";
ALTER TABLE "avs_booking_requests" ADD CONSTRAINT "avs_booking_type_check" CHECK ("meeting_type" IN ('IN_PERSON', 'ONLINE', 'HOME', 'ONLINE_VISIO'));

DO $$ BEGIN
  ALTER TABLE "avs_booking_requests" ADD CONSTRAINT "avs_booking_payment_mode_check" CHECK ("payment_mode" IN ('PAY_ON_SITE', 'PLATFORM_ESCROW'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "avs_booking_requests" ADD CONSTRAINT "avs_booking_escrow_status_check" CHECK ("escrow_status" IN ('NOT_APPLICABLE', 'HELD_IN_ESCROW', 'RELEASED_TO_PRACTITIONER', 'REFUNDED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "avs_booking_live_session_idx" ON "avs_booking_requests" ("live_session_id");
CREATE INDEX IF NOT EXISTS "avs_booking_payment_mode_idx" ON "avs_booking_requests" ("payment_mode");

-- 5. Extend live_sessions with category
ALTER TABLE "live_sessions"
  ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'EDUCATION_INCLUSIVE';

CREATE INDEX IF NOT EXISTS "live_sessions_category_idx" ON "live_sessions" ("category");

-- 6. Extend courses with professional promotion qualification
ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "qualifies_for_professional_promotion" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "qualifying_target_type" text,
  ADD COLUMN IF NOT EXISTS "qualifying_target_category" text;

-- 7. Extend webinars with category and course_id
ALTER TABLE "webinars"
  ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'EDUCATION_INCLUSIVE',
  ADD COLUMN IF NOT EXISTS "course_id" text REFERENCES "courses"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "webinars_category_idx" ON "webinars" ("category");
CREATE INDEX IF NOT EXISTS "webinars_course_idx" ON "webinars" ("course_id");

