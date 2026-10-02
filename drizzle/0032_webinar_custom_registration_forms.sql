ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "form_fields" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "require_approval" boolean NOT NULL DEFAULT true;

ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "answers" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "access_code" text;

DO $$ BEGIN
  ALTER TABLE "webinar_registrations" DROP CONSTRAINT IF EXISTS "webinar_registrations_status_check";
  ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_status_check" CHECK ("status" IN ('REGISTERED', 'PENDING_APPROVAL', 'ACCEPTED', 'ATTENDED', 'CANCELLED'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "webinar_registration_access_code_unique" ON "webinar_registrations" ("access_code") WHERE "access_code" IS NOT NULL;
