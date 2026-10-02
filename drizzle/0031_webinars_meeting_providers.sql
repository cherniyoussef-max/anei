ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "meeting_provider" text NOT NULL DEFAULT 'google_meet';
ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "meeting_id" text;
ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "meeting_passcode" text;
ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "target_audience" text DEFAULT 'ALL';
ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "max_participants" integer DEFAULT 250;
DO $$ BEGIN
  ALTER TABLE "webinars" ADD CONSTRAINT "webinars_meeting_provider_check" CHECK ("meeting_provider" IN ('google_meet', 'teams', 'zoom', 'custom'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "webinar_registrations" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "guest_name" text;
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "guest_email" text;
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "guest_phone" text;
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "join_token" text;
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "joined_at" timestamp with time zone;

DO $$ BEGIN
  ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_status_check" CHECK ("status" IN ('REGISTERED', 'ATTENDED', 'CANCELLED'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "webinar_registration_join_token_unique" ON "webinar_registrations" ("join_token") WHERE "join_token" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "webinar_registration_guest_unique" ON "webinar_registrations" ("webinar_id", "guest_email") WHERE "guest_email" IS NOT NULL;
