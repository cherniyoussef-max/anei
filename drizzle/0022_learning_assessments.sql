CREATE TABLE "learning_assessment" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "module_id" text REFERENCES "course_modules"("id") ON DELETE CASCADE,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "instructions_fr" text DEFAULT '' NOT NULL,
  "instructions_ar" text DEFAULT '' NOT NULL,
  "time_limit_seconds" integer DEFAULT 900 NOT NULL,
  "passing_score" integer DEFAULT 70 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "reveal_answers_after_pass" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "learning_assessment_time_limit_check" CHECK ("time_limit_seconds" between 60 and 14400),
  CONSTRAINT "learning_assessment_passing_score_check" CHECK ("passing_score" between 0 and 100),
  CONSTRAINT "learning_assessment_max_attempts_check" CHECK ("max_attempts" between 1 and 10)
);
CREATE INDEX "learning_assessment_course_idx" ON "learning_assessment" ("course_id", "published");
CREATE INDEX "learning_assessment_module_idx" ON "learning_assessment" ("module_id");

CREATE TABLE "learning_question" (
  "id" text PRIMARY KEY NOT NULL,
  "assessment_id" text NOT NULL REFERENCES "learning_assessment"("id") ON DELETE CASCADE,
  "prompt_fr" text NOT NULL,
  "prompt_ar" text NOT NULL,
  "type" text NOT NULL,
  "position" integer NOT NULL,
  "points" integer NOT NULL,
  "explanation_fr" text,
  "explanation_ar" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "learning_question_assessment_position_unique" UNIQUE("assessment_id", "position"),
  CONSTRAINT "learning_question_type_check" CHECK ("type" in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE')),
  CONSTRAINT "learning_question_position_check" CHECK ("position" between 1 and 1000),
  CONSTRAINT "learning_question_points_check" CHECK ("points" between 1 and 100)
);
CREATE INDEX "learning_question_assessment_idx" ON "learning_question" ("assessment_id");

CREATE TABLE "learning_question_option" (
  "id" text PRIMARY KEY NOT NULL,
  "question_id" text NOT NULL REFERENCES "learning_question"("id") ON DELETE CASCADE,
  "text_fr" text NOT NULL,
  "text_ar" text NOT NULL,
  "position" integer NOT NULL,
  "is_correct" boolean DEFAULT false NOT NULL,
  CONSTRAINT "learning_question_option_position_unique" UNIQUE("question_id", "position"),
  CONSTRAINT "learning_question_option_position_check" CHECK ("position" between 1 and 20)
);
CREATE INDEX "learning_question_option_question_idx" ON "learning_question_option" ("question_id");

CREATE TABLE "learning_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "assessment_id" text NOT NULL REFERENCES "learning_assessment"("id") ON DELETE CASCADE,
  "enrollment_id" text NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "status" text DEFAULT 'IN_PROGRESS' NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "submitted_at" timestamptz,
  "raw_points" integer,
  "max_points" integer,
  "percentage" integer,
  "passed" boolean,
  CONSTRAINT "learning_attempt_user_number_unique" UNIQUE("assessment_id", "user_id", "attempt_number"),
  CONSTRAINT "learning_attempt_number_check" CHECK ("attempt_number" between 1 and 10),
  CONSTRAINT "learning_attempt_status_check" CHECK ("status" in ('IN_PROGRESS','SUBMITTED','EXPIRED','GRADED')),
  CONSTRAINT "learning_attempt_points_check" CHECK ("raw_points" is null or "raw_points" >= 0),
  CONSTRAINT "learning_attempt_max_points_check" CHECK ("max_points" is null or "max_points" > 0),
  CONSTRAINT "learning_attempt_percentage_check" CHECK ("percentage" is null or "percentage" between 0 and 100)
);
CREATE UNIQUE INDEX "learning_attempt_one_active_unique" ON "learning_attempt" ("assessment_id", "user_id") WHERE "status" = 'IN_PROGRESS';
CREATE INDEX "learning_attempt_assessment_submitted_idx" ON "learning_attempt" ("assessment_id", "submitted_at");
CREATE INDEX "learning_attempt_user_idx" ON "learning_attempt" ("user_id", "started_at");

CREATE TABLE "learning_answer" (
  "id" text PRIMARY KEY NOT NULL,
  "attempt_id" text NOT NULL REFERENCES "learning_attempt"("id") ON DELETE CASCADE,
  "question_id" text NOT NULL REFERENCES "learning_question"("id") ON DELETE CASCADE,
  "selected_option_ids" jsonb NOT NULL,
  "points_awarded" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "learning_answer_attempt_question_unique" UNIQUE("attempt_id", "question_id"),
  CONSTRAINT "learning_answer_points_check" CHECK ("points_awarded" >= 0)
);
CREATE INDEX "learning_answer_attempt_idx" ON "learning_answer" ("attempt_id");
