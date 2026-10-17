-- Migration: 0049_practitioner_availability_and_booking_pipeline.sql
-- Adds availability fields, weekly schedule JSONB, and booking pipeline enhancements.

ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "availability_status_label" text DEFAULT 'IMMEDIATE_FULL_TIME' NOT NULL;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "accepted_modalities" text DEFAULT 'BOTH' NOT NULL;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "available_locations_text" text DEFAULT '' NOT NULL;
ALTER TABLE "avs_profiles" ADD COLUMN IF NOT EXISTS "weekly_schedule" jsonb DEFAULT '{"0":{"enabled":false,"slots":["09:00","10:30","14:00","15:30"]},"1":{"enabled":true,"slots":["09:00","10:30","14:00","15:30","17:00"]},"2":{"enabled":true,"slots":["09:00","10:30","14:00","15:30","17:00"]},"3":{"enabled":true,"slots":["09:00","10:30","14:00","15:30","17:00"]},"4":{"enabled":true,"slots":["09:00","10:30","14:00","15:30","17:00"]},"5":{"enabled":true,"slots":["09:00","10:30","14:00","15:30","17:00"]},"6":{"enabled":true,"slots":["09:00","10:30","12:00"]}}' NOT NULL;

ALTER TABLE "avs_booking_requests" ADD COLUMN IF NOT EXISTS "parent_location" text;
ALTER TABLE "avs_booking_requests" ALTER COLUMN "status" SET DEFAULT 'AWAITING_PRACTITIONER_CONFIRMATION';

ALTER TABLE "avs_booking_requests" DROP CONSTRAINT IF EXISTS "avs_booking_status_check";
ALTER TABLE "avs_booking_requests" ADD CONSTRAINT "avs_booking_status_check" CHECK ("status" in ('AWAITING_PRACTITIONER_CONFIRMATION', 'PENDING', 'CONFIRMED', 'DECLINED', 'COMPLETED'));
