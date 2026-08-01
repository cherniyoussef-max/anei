-- Backward-compatible LMS hierarchy: modules/chapters are optional for existing lessons.
CREATE TABLE "course_modules" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "position" integer NOT NULL,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "description_fr" text DEFAULT '' NOT NULL,
  "description_ar" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "course_modules_position_positive" CHECK ("position" > 0)
);
CREATE UNIQUE INDEX "course_modules_course_position_unique" ON "course_modules" ("course_id", "position");
CREATE INDEX "course_modules_course_idx" ON "course_modules" ("course_id");
ALTER TABLE "lessons" ADD COLUMN "module_id" text;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "lessons_module_idx" ON "lessons" ("module_id");
