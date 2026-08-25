CREATE TABLE "course_discussion_posts" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "author_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "parent_id" text,
  "body" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "course_discussion_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "course_discussion_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "course_discussion_body_length_check" CHECK (char_length(btrim("body")) between 2 and 2000)
);

CREATE INDEX "course_discussion_course_created_idx" ON "course_discussion_posts" ("course_id", "created_at");
CREATE INDEX "course_discussion_parent_idx" ON "course_discussion_posts" ("parent_id");
CREATE INDEX "course_discussion_author_idx" ON "course_discussion_posts" ("author_user_id", "created_at");
