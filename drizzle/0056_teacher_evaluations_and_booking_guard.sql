-- Migration: 0056_teacher_evaluations_and_booking_guard.sql
-- Description: Teacher evaluations persistence, establishment event registrations, and AVS booking race condition protection

-- Deduplicate any existing duplicate active bookings before creating the index
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY avs_profile_id, requested_date, requested_time_slot 
           ORDER BY created_at ASC
         ) AS rn
  FROM avs_booking_requests
  WHERE status IN ('AWAITING_PRACTITIONER_CONFIRMATION', 'PENDING', 'CONFIRMED')
)
UPDATE avs_booking_requests
SET status = 'DECLINED'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "avs_booking_slot_unique"
ON "avs_booking_requests" ("avs_profile_id", "requested_date", "requested_time_slot")
WHERE "status" IN ('AWAITING_PRACTITIONER_CONFIRMATION', 'PENDING', 'CONFIRMED');

CREATE TABLE IF NOT EXISTS "teacher_evaluations" (
  "id" text PRIMARY KEY,
  "classroom_id" text NOT NULL REFERENCES "teacher_classrooms"("id") ON DELETE CASCADE,
  "teacher_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 30,
  "questions_json" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "teacher_evaluations_classroom_idx" ON "teacher_evaluations" ("classroom_id");
CREATE INDEX IF NOT EXISTS "teacher_evaluations_teacher_idx" ON "teacher_evaluations" ("teacher_user_id");

CREATE TABLE IF NOT EXISTS "establishment_event_registrations" (
  "id" text PRIMARY KEY,
  "establishment_id" text NOT NULL REFERENCES "partner_establishments"("id") ON DELETE CASCADE,
  "event_id" text NOT NULL,
  "event_type" text NOT NULL DEFAULT 'EVENT',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "establishment_event_reg_unique" ON "establishment_event_registrations" ("establishment_id", "event_id");
CREATE INDEX IF NOT EXISTS "establishment_event_reg_est_idx" ON "establishment_event_registrations" ("establishment_id");
