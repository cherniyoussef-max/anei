ALTER TABLE "webinars" ADD COLUMN IF NOT EXISTS "location" text;

ALTER TABLE "webinars" DROP CONSTRAINT IF EXISTS "webinars_meeting_provider_check";
ALTER TABLE "webinars" ADD CONSTRAINT "webinars_meeting_provider_check" CHECK ("meeting_provider" IN ('google_meet', 'teams', 'zoom', 'custom', 'in_person'));

UPDATE "webinars"
SET "location" = "meeting_url", "meeting_url" = NULL
WHERE "meeting_provider" = 'in_person' AND "meeting_url" IS NOT NULL;

