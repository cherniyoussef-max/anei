CREATE TABLE IF NOT EXISTS "video_checkpoint" (
  "id" text PRIMARY KEY NOT NULL,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "trigger_seconds" integer NOT NULL,
  "kind" text DEFAULT 'REFLECTION' NOT NULL,
  "prompt_fr" text NOT NULL,
  "prompt_ar" text NOT NULL,
  "options" jsonb,
  "correct_option_id" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "video_checkpoint_kind_check" CHECK ("kind" IN ('REFLECTION','QUIZ')),
  CONSTRAINT "video_checkpoint_trigger_check" CHECK ("trigger_seconds" >= 0)
);
CREATE INDEX IF NOT EXISTS "video_checkpoint_lesson_idx" ON "video_checkpoint" ("lesson_id", "trigger_seconds");

CREATE TABLE IF NOT EXISTS "video_checkpoint_response" (
  "id" text PRIMARY KEY NOT NULL,
  "enrollment_id" text NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "checkpoint_id" text NOT NULL REFERENCES "video_checkpoint"("id") ON DELETE CASCADE,
  "response_text" text,
  "selected_option_id" text,
  "correct" boolean,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "video_checkpoint_response_unique" ON "video_checkpoint_response" ("enrollment_id", "checkpoint_id");
