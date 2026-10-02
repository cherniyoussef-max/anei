ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "governorate_fr" text NOT NULL DEFAULT 'Tunis';
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "governorate_ar" text NOT NULL DEFAULT 'تونس';
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "intervention_domains" text[];
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "pedagogical_methods" text[];
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "schools_covered_fr" text NOT NULL DEFAULT '';
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "schools_covered_ar" text NOT NULL DEFAULT '';
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "hourly_rate_millimes" integer NOT NULL DEFAULT 25000;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "experience_years" integer NOT NULL DEFAULT 3;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "address_fr" text NOT NULL DEFAULT '';
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "address_ar" text NOT NULL DEFAULT '';
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "rating" integer NOT NULL DEFAULT 49;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "review_count" integer NOT NULL DEFAULT 12;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "avs_slug_unique" ON "avs_profiles" ("slug");
CREATE INDEX IF NOT EXISTS "avs_governorate_idx" ON "avs_profiles" ("governorate_fr");

CREATE TABLE IF NOT EXISTS "avs_booking_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "avs_profile_id" text NOT NULL REFERENCES "avs_profiles"("id") ON DELETE CASCADE,
  "parent_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "parent_name" text NOT NULL,
  "parent_email" text NOT NULL,
  "parent_phone" text NOT NULL,
  "child_name" text NOT NULL,
  "child_age" integer,
  "school_name" text,
  "need_description" text NOT NULL,
  "intervention_domain" text,
  "requested_date" date NOT NULL,
  "requested_time_slot" text NOT NULL,
  "meeting_type" text NOT NULL DEFAULT 'IN_PERSON',
  "status" text NOT NULL DEFAULT 'PENDING',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "avs_booking_profile_idx" ON "avs_booking_requests" ("avs_profile_id");
CREATE INDEX IF NOT EXISTS "avs_booking_parent_idx" ON "avs_booking_requests" ("parent_user_id");
CREATE INDEX IF NOT EXISTS "avs_booking_status_idx" ON "avs_booking_requests" ("status");
CREATE INDEX IF NOT EXISTS "avs_booking_date_idx" ON "avs_booking_requests" ("requested_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'avs_booking_status_check'
  ) THEN
    ALTER TABLE "avs_booking_requests"
      ADD CONSTRAINT "avs_booking_status_check"
      CHECK ("status" IN ('PENDING', 'CONFIRMED', 'DECLINED', 'COMPLETED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'avs_booking_type_check'
  ) THEN
    ALTER TABLE "avs_booking_requests"
      ADD CONSTRAINT "avs_booking_type_check"
      CHECK ("meeting_type" IN ('IN_PERSON', 'ONLINE', 'HOME'));
  END IF;
END $$;
