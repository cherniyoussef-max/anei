DO $$ BEGIN
  ALTER TABLE "webinar_registrations" DROP CONSTRAINT IF EXISTS "webinar_registrations_status_check";
  ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_status_check" CHECK ("status" IN ('REGISTERED', 'PENDING_APPROVAL', 'ACCEPTED', 'REJECTED', 'ATTENDED', 'CANCELLED'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
