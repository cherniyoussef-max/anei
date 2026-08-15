-- Persona membership: multi-persona-per-user model. Additive only — does not
-- touch user.role (Better Auth security role) or user.profileType (kept for
-- backward compatibility). See docs/premium/ARCHITECTURE.md §2.
CREATE TABLE "persona_membership" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "persona" text NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "persona_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "persona_membership_persona_check" CHECK ("persona" in ('TEACHER','AVS','PARENT','SPECIALIST','ORGANIZATION','STUDENT')),
  CONSTRAINT "persona_membership_status_check" CHECK ("status" in ('PENDING_REVIEW','ACTIVE','SUSPENDED','REJECTED'))
);
CREATE UNIQUE INDEX "persona_membership_user_persona_unique" ON "persona_membership" ("user_id", "persona");
CREATE UNIQUE INDEX "persona_membership_user_primary_unique" ON "persona_membership" ("user_id") WHERE "is_primary" = true;
CREATE INDEX "persona_membership_user_idx" ON "persona_membership" ("user_id");
CREATE INDEX "persona_membership_persona_idx" ON "persona_membership" ("persona");
CREATE INDEX "persona_membership_status_idx" ON "persona_membership" ("status");

-- Backfill: one primary persona row per existing user, derived from
-- user.profile_type (learner→STUDENT, teacher→TEACHER, avs→AVS,
-- parent→PARENT, specialist→SPECIALIST, institution→ORGANIZATION).
-- Professional personas start PENDING_REVIEW; STUDENT/PARENT start ACTIVE.
-- ON CONFLICT DO NOTHING makes this safe to re-run (idempotent migration).
INSERT INTO "persona_membership" ("id", "user_id", "persona", "status", "is_primary", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  u."id",
  CASE u."profile_type"
    WHEN 'teacher' THEN 'TEACHER'
    WHEN 'avs' THEN 'AVS'
    WHEN 'parent' THEN 'PARENT'
    WHEN 'specialist' THEN 'SPECIALIST'
    WHEN 'institution' THEN 'ORGANIZATION'
    ELSE 'STUDENT'
  END,
  CASE u."profile_type"
    WHEN 'teacher' THEN 'PENDING_REVIEW'
    WHEN 'avs' THEN 'PENDING_REVIEW'
    WHEN 'specialist' THEN 'PENDING_REVIEW'
    WHEN 'institution' THEN 'PENDING_REVIEW'
    ELSE 'ACTIVE'
  END,
  true,
  now(),
  now()
FROM "user" u
ON CONFLICT ("user_id", "persona") DO NOTHING;
