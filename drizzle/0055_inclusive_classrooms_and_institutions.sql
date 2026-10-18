-- Migration: 0055_inclusive_classrooms_and_institutions.sql
-- Description: Tripartite ecosystem for inclusive education (Teacher Classroom, Partner Establishment, Specialist, Admin)

CREATE TABLE IF NOT EXISTS "teacher_classrooms" (
  "id" text PRIMARY KEY,
  "teacher_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "class_name" text NOT NULL,
  "palette_preset" text NOT NULL DEFAULT 'Classique',
  "custom_colors_json" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "teacher_classrooms_teacher_idx" ON "teacher_classrooms" ("teacher_user_id");

CREATE TABLE IF NOT EXISTS "teacher_classroom_students" (
  "id" text PRIMARY KEY,
  "classroom_id" text NOT NULL REFERENCES "teacher_classrooms"("id") ON DELETE CASCADE,
  "teacher_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "display_name" text NOT NULL,
  "difficulties" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "adaptations" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "personal_note" text NOT NULL DEFAULT '',
  "download_status" text NOT NULL DEFAULT 'A_TELECHARGER',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "teacher_classroom_students_classroom_idx" ON "teacher_classroom_students" ("classroom_id");
CREATE INDEX IF NOT EXISTS "teacher_classroom_students_teacher_idx" ON "teacher_classroom_students" ("teacher_user_id");

CREATE TABLE IF NOT EXISTS "partner_establishments" (
  "id" text PRIMARY KEY,
  "manager_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "level" text NOT NULL DEFAULT 'Collège',
  "region" text NOT NULL DEFAULT 'Tunis',
  "student_count" integer NOT NULL DEFAULT 0,
  "needs_breakdown_json" jsonb NOT NULL DEFAULT '{"dys":0,"tdah":0,"vis":0,"aud":0,"tsa":0,"comp":0}'::jsonb,
  "existing_resources_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "constraints_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "partnership_stage" integer NOT NULL DEFAULT 2,
  "convention_signed_at" timestamptz,
  "self_eval_answers_json" jsonb,
  "self_eval_score_percent" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "partner_establishments_manager_idx" ON "partner_establishments" ("manager_user_id");
CREATE INDEX IF NOT EXISTS "partner_establishments_region_idx" ON "partner_establishments" ("region");

CREATE TABLE IF NOT EXISTS "establishment_service_requests" (
  "id" text PRIMARY KEY,
  "reference_code" text NOT NULL,
  "establishment_id" text NOT NULL REFERENCES "partner_establishments"("id") ON DELETE CASCADE,
  "assigned_specialist_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "service_type" text NOT NULL,
  "urgency" text NOT NULL DEFAULT 'Normale',
  "concerned_count" integer NOT NULL DEFAULT 1,
  "situation_description" text NOT NULL,
  "stage" integer NOT NULL DEFAULT 0,
  "scheduled_rdv_json" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "establishment_service_requests_code_unique" ON "establishment_service_requests" ("reference_code");
CREATE INDEX IF NOT EXISTS "establishment_service_requests_est_idx" ON "establishment_service_requests" ("establishment_id");
CREATE INDEX IF NOT EXISTS "establishment_service_requests_specialist_idx" ON "establishment_service_requests" ("assigned_specialist_user_id");
CREATE INDEX IF NOT EXISTS "establishment_service_requests_stage_idx" ON "establishment_service_requests" ("stage");

CREATE TABLE IF NOT EXISTS "service_request_messages" (
  "id" text PRIMARY KEY,
  "request_id" text NOT NULL REFERENCES "establishment_service_requests"("id") ON DELETE CASCADE,
  "sender_role" text NOT NULL,
  "sender_name" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "service_request_messages_request_idx" ON "service_request_messages" ("request_id", "created_at");

CREATE TABLE IF NOT EXISTS "specialist_classroom_tips" (
  "id" text PRIMARY KEY,
  "author_specialist_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "author_name" text NOT NULL,
  "difficulty_key" text NOT NULL,
  "situation_title" text NOT NULL,
  "what_to_do" text NOT NULL,
  "what_to_avoid" text NOT NULL,
  "is_published" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "specialist_classroom_tips_diff_idx" ON "specialist_classroom_tips" ("difficulty_key", "is_published");
CREATE INDEX IF NOT EXISTS "specialist_classroom_tips_author_idx" ON "specialist_classroom_tips" ("author_specialist_user_id");
