-- Migration 0037: Specialist care relationships and conversation foundation
ALTER TABLE "specialist_student_assignment"
  ADD COLUMN IF NOT EXISTS "requested_by_user_id" text REFERENCES "user"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "request_message" text,
  ADD COLUMN IF NOT EXISTS "decline_reason" text,
  ADD COLUMN IF NOT EXISTS "consent_accepted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "consent_version" text,
  ADD COLUMN IF NOT EXISTS "ended_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "end_reason" text;

ALTER TABLE "specialist_student_assignment"
  DROP CONSTRAINT IF EXISTS "specialist_student_assignment_status_check";

ALTER TABLE "specialist_student_assignment"
  ADD CONSTRAINT "specialist_student_assignment_status_check"
  CHECK ("status" IN ('PENDING', 'ACTIVE', 'DECLINED', 'ENDED'));

DROP INDEX IF EXISTS "specialist_student_assignment_active_unique";

CREATE UNIQUE INDEX "specialist_student_assignment_active_unique"
  ON "specialist_student_assignment" ("specialist_user_id", "student_user_id")
  WHERE "status" IN ('PENDING', 'ACTIVE');

CREATE INDEX IF NOT EXISTS "specialist_student_assignment_requested_by_idx"
  ON "specialist_student_assignment" ("requested_by_user_id");

ALTER TABLE "specialist_profile"
  ADD COLUMN IF NOT EXISTS "sub_specialties" text[],
  ADD COLUMN IF NOT EXISTS "license_number" text,
  ADD COLUMN IF NOT EXISTS "languages" text[] DEFAULT '{"fr","ar"}'::text[],
  ADD COLUMN IF NOT EXISTS "governorate" text,
  ADD COLUMN IF NOT EXISTS "city" text,
  ADD COLUMN IF NOT EXISTS "consultation_modes" text[] DEFAULT '{"IN_PERSON","ONLINE"}'::text[],
  ADD COLUMN IF NOT EXISTS "bio_fr" text,
  ADD COLUMN IF NOT EXISTS "bio_ar" text,
  ADD COLUMN IF NOT EXISTS "avatar_url" text,
  ADD COLUMN IF NOT EXISTS "address" text;

CREATE TABLE IF NOT EXISTS "care_conversation" (
  "id" text PRIMARY KEY,
  "specialist_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "student_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "care_relationship_id" text NOT NULL REFERENCES "specialist_student_assignment"("id") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'OPEN',
  "last_message_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "care_conversation_status_check" CHECK ("status" IN ('OPEN', 'READ_ONLY'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "care_conversation_relationship_unique"
  ON "care_conversation" ("care_relationship_id");

CREATE INDEX IF NOT EXISTS "care_conversation_student_idx"
  ON "care_conversation" ("student_user_id");

CREATE INDEX IF NOT EXISTS "care_conversation_specialist_idx"
  ON "care_conversation" ("specialist_user_id", "status");

CREATE TABLE IF NOT EXISTS "care_conversation_participant" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "care_conversation"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "last_read_at" timestamp with time zone,
  "muted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "care_conversation_participant_role_check" CHECK ("role" IN ('SPECIALIST', 'PARENT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "care_conversation_participant_unique"
  ON "care_conversation_participant" ("conversation_id", "user_id");

CREATE INDEX IF NOT EXISTS "care_conversation_participant_user_idx"
  ON "care_conversation_participant" ("user_id");
