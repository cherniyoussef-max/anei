-- Rollback for Migration 0034: webinar_location_field
-- Restores meeting_url from location for in_person sessions and removes location column

DO $$ BEGIN
  UPDATE "webinars"
  SET "meeting_url" = "location"
  WHERE "meeting_provider" = 'in_person' AND "meeting_url" IS NULL AND "location" IS NOT NULL;

  ALTER TABLE "webinars" DROP CONSTRAINT IF EXISTS "webinars_meeting_provider_check";
  ALTER TABLE "webinars" ADD CONSTRAINT "webinars_meeting_provider_check"
    CHECK ("meeting_provider" IN ('google_meet', 'teams', 'zoom', 'custom'));

  ALTER TABLE "webinars" DROP COLUMN IF EXISTS "location";
END $$;
