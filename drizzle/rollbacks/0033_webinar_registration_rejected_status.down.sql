-- Rollback for Migration 0033: webinar_registration_rejected_status
-- Ensures no disallowed row becomes joinable in the legacy schema:
-- REJECTED and PENDING_APPROVAL -> CANCELLED (strictly non-joinable)
-- ACCEPTED -> REGISTERED (the legacy approved joinable status)

DO $$ BEGIN
  -- 1. Map disallowed statuses to CANCELLED so they can NEVER join under the rolled-back schema
  UPDATE "webinar_registrations"
  SET "status" = 'CANCELLED'
  WHERE "status" IN ('REJECTED', 'PENDING_APPROVAL');

  -- 2. Map approved ACCEPTED status to legacy REGISTERED status
  UPDATE "webinar_registrations"
  SET "status" = 'REGISTERED'
  WHERE "status" = 'ACCEPTED';

  -- 3. Restore constraint to pre-0033 allowed set ('REGISTERED', 'ATTENDED', 'CANCELLED')
  ALTER TABLE "webinar_registrations" DROP CONSTRAINT IF EXISTS "webinar_registrations_status_check";
  ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_status_check"
    CHECK ("status" IN ('REGISTERED', 'ATTENDED', 'CANCELLED'));
END $$;
