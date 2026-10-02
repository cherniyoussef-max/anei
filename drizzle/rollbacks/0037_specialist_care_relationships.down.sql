-- Rollback for Migration 0037: Specialist care relationships and conversation foundation
DROP TABLE IF EXISTS "care_conversation_participant";
DROP TABLE IF EXISTS "care_conversation";

ALTER TABLE "specialist_profile"
  DROP COLUMN IF EXISTS "sub_specialties",
  DROP COLUMN IF EXISTS "license_number",
  DROP COLUMN IF EXISTS "languages",
  DROP COLUMN IF EXISTS "governorate",
  DROP COLUMN IF EXISTS "city",
  DROP COLUMN IF EXISTS "consultation_modes",
  DROP COLUMN IF EXISTS "bio_fr",
  DROP COLUMN IF EXISTS "bio_ar",
  DROP COLUMN IF EXISTS "avatar_url",
  DROP COLUMN IF EXISTS "address";

DROP INDEX IF EXISTS "specialist_student_assignment_requested_by_idx";
DROP INDEX IF EXISTS "specialist_student_assignment_active_unique";

CREATE UNIQUE INDEX "specialist_student_assignment_active_unique"
  ON "specialist_student_assignment" ("specialist_user_id", "student_user_id")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "specialist_student_assignment"
  DROP CONSTRAINT IF EXISTS "specialist_student_assignment_status_check";

-- Revert statuses that would violate the original ('ACTIVE', 'ENDED') constraint
UPDATE "specialist_student_assignment"
  SET "status" = 'ENDED'
  WHERE "status" IN ('PENDING', 'DECLINED');

ALTER TABLE "specialist_student_assignment"
  ADD CONSTRAINT "specialist_student_assignment_status_check"
  CHECK ("status" IN ('ACTIVE', 'ENDED'));

ALTER TABLE "specialist_student_assignment"
  DROP COLUMN IF EXISTS "requested_by_user_id",
  DROP COLUMN IF EXISTS "request_message",
  DROP COLUMN IF EXISTS "decline_reason",
  DROP COLUMN IF EXISTS "consent_accepted_at",
  DROP COLUMN IF EXISTS "consent_version",
  DROP COLUMN IF EXISTS "ended_by_user_id",
  DROP COLUMN IF EXISTS "end_reason";
