-- Migration: 0057_avs_secure_certification_pipeline.sql
-- Description: Zero-Trust AVS certification pipeline, cryptographic unique identifiers, and LMS certification log

ALTER TABLE "avs_profiles" 
  ADD COLUMN IF NOT EXISTS "unique_identifier" text,
  ADD COLUMN IF NOT EXISTS "education_level" text,
  ADD COLUMN IF NOT EXISTS "specialties_json" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "methods_json" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "covered_schools_or_zones" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "verification_status" text NOT NULL DEFAULT 'PENDING_TRAINING',
  ADD COLUMN IF NOT EXISTS "verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "verified_by_admin_id" text REFERENCES "user"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "avs_unique_identifier_unique" ON "avs_profiles" ("unique_identifier");
CREATE INDEX IF NOT EXISTS "avs_verification_status_idx" ON "avs_profiles" ("verification_status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'avs_verification_status_check'
  ) THEN
    ALTER TABLE "avs_profiles" ADD CONSTRAINT "avs_verification_status_check" 
      CHECK ("verification_status" IN ('PENDING_TRAINING', 'CERTIFIED_ACTIVE', 'SUSPENDED'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "avs_certifications_log" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "avs_profile_id" text NOT NULL REFERENCES "avs_profiles"("id") ON DELETE CASCADE,
  "course_id" text NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "score_percent" integer NOT NULL,
  "certificate_hash" text NOT NULL,
  "issued_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "avs_cert_hash_unique" ON "avs_certifications_log" ("certificate_hash");
CREATE INDEX IF NOT EXISTS "avs_cert_user_idx" ON "avs_certifications_log" ("user_id");
CREATE INDEX IF NOT EXISTS "avs_cert_profile_idx" ON "avs_certifications_log" ("avs_profile_id");
CREATE INDEX IF NOT EXISTS "avs_cert_course_idx" ON "avs_certifications_log" ("course_id");

-- Backfill unique identifiers for any existing certified profiles
UPDATE "avs_profiles"
SET 
  "unique_identifier" = 'ANEI-AVS-2026-' || UPPER(SUBSTRING(MD5(id || 'anei-salt') FROM 1 FOR 6)),
  "verification_status" = 'CERTIFIED_ACTIVE',
  "verified_at" = now()
WHERE "certified" = true AND ("unique_identifier" IS NULL OR "unique_identifier" = '');
