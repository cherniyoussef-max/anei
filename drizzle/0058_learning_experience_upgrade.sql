-- ANEI Learning Experience Upgrade: Additive Cognitive Science & Spaced Repetition Tables

CREATE TABLE IF NOT EXISTS "lesson_chapters" (
  "id" text PRIMARY KEY,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "start_seconds" integer NOT NULL DEFAULT 0,
  "position" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "lesson_chapters_seconds_positive" CHECK ("start_seconds" >= 0)
);
CREATE INDEX IF NOT EXISTS "lesson_chapters_lesson_idx" ON "lesson_chapters" ("lesson_id", "start_seconds");

CREATE TABLE IF NOT EXISTS "lesson_transcripts" (
  "id" text PRIMARY KEY,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "language" text NOT NULL DEFAULT 'fr',
  "cues" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_transcripts_lesson_lang_unique" ON "lesson_transcripts" ("lesson_id", "language");

CREATE TABLE IF NOT EXISTS "lesson_takeaways" (
  "id" text PRIMARY KEY,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "summary_fr" text NOT NULL,
  "summary_ar" text NOT NULL,
  "timestamp_seconds" integer NOT NULL DEFAULT 0,
  "position" integer NOT NULL DEFAULT 1,
  "is_draft" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lesson_takeaways_lesson_idx" ON "lesson_takeaways" ("lesson_id", "position");

CREATE TABLE IF NOT EXISTS "lesson_personal_notes" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "timestamp_seconds" integer NOT NULL DEFAULT 0,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lesson_notes_user_lesson_idx" ON "lesson_personal_notes" ("user_id", "lesson_id");

CREATE TABLE IF NOT EXISTS "lesson_flashcards" (
  "id" text PRIMARY KEY,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "concept_fr" text NOT NULL,
  "concept_ar" text NOT NULL,
  "definition_fr" text NOT NULL,
  "definition_ar" text NOT NULL,
  "context_scenario_fr" text,
  "context_scenario_ar" text,
  "position" integer NOT NULL DEFAULT 1,
  "is_draft" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lesson_flashcards_lesson_idx" ON "lesson_flashcards" ("lesson_id");

CREATE TABLE IF NOT EXISTS "learner_flashcard_reviews" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "card_id" text NOT NULL REFERENCES "lesson_flashcards"("id") ON DELETE CASCADE,
  "ease_factor" real NOT NULL DEFAULT 2.5,
  "interval_days" integer NOT NULL DEFAULT 0,
  "repetition_count" integer NOT NULL DEFAULT 0,
  "next_review_date" timestamptz NOT NULL DEFAULT now(),
  "last_reviewed_at" timestamptz,
  "last_grade" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_card_unique" ON "learner_flashcard_reviews" ("user_id", "card_id");
CREATE INDEX IF NOT EXISTS "learner_reviews_due_idx" ON "learner_flashcard_reviews" ("user_id", "next_review_date");

CREATE TABLE IF NOT EXISTS "lesson_practice_actions" (
  "id" text PRIMARY KEY,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "instructions_fr" text NOT NULL,
  "instructions_ar" text NOT NULL,
  "is_draft" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lesson_practice_lesson_idx" ON "lesson_practice_actions" ("lesson_id");

CREATE TABLE IF NOT EXISTS "learner_practice_logs" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "practice_action_id" text NOT NULL REFERENCES "lesson_practice_actions"("id") ON DELETE CASCADE,
  "tried_it" boolean NOT NULL DEFAULT false,
  "reflection_note" text,
  "logged_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_practice_unique" ON "learner_practice_logs" ("user_id", "practice_action_id");

CREATE TABLE IF NOT EXISTS "lesson_quiz_questions" (
  "id" text PRIMARY KEY,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "prompt_fr" text NOT NULL,
  "prompt_ar" text NOT NULL,
  "type" text NOT NULL DEFAULT 'SINGLE_CHOICE',
  "options" jsonb NOT NULL,
  "correct_option_ids" jsonb NOT NULL,
  "explanation_fr" text NOT NULL,
  "explanation_ar" text NOT NULL,
  "timestamp_seconds" integer,
  "position" integer NOT NULL DEFAULT 1,
  "is_draft" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lesson_quiz_questions_lesson_idx" ON "lesson_quiz_questions" ("lesson_id", "position");

CREATE TABLE IF NOT EXISTS "learner_quiz_attempts" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "lesson_id" text NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "score_percentage" integer NOT NULL,
  "passed" boolean NOT NULL,
  "answers" jsonb NOT NULL,
  "completed_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "learner_quiz_attempts_user_lesson_idx" ON "learner_quiz_attempts" ("user_id", "lesson_id");
