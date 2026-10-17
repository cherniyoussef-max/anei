CREATE TABLE IF NOT EXISTS "live_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "description_fr" text,
  "description_ar" text,
  "provider" text NOT NULL,
  "external_meeting_url" text NOT NULL,
  "embed_mode" text NOT NULL,
  "scope" text NOT NULL,
  "course_id" text REFERENCES "courses"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'SCHEDULED',
  "scheduled_start_at" timestamp with time zone NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 60,
  "is_broadcast_pushed" boolean NOT NULL DEFAULT false,
  "created_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "live_attendances" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "live_sessions"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_agent" text
);

CREATE INDEX IF NOT EXISTS "live_sessions_status_idx" ON "live_sessions" ("status");
CREATE INDEX IF NOT EXISTS "live_sessions_scheduled_start_idx" ON "live_sessions" ("scheduled_start_at");
CREATE INDEX IF NOT EXISTS "live_sessions_scope_idx" ON "live_sessions" ("scope");
CREATE INDEX IF NOT EXISTS "live_sessions_course_idx" ON "live_sessions" ("course_id");
CREATE INDEX IF NOT EXISTS "live_sessions_broadcast_pushed_idx" ON "live_sessions" ("is_broadcast_pushed");

CREATE UNIQUE INDEX IF NOT EXISTS "live_attendances_session_user_unique" ON "live_attendances" ("session_id", "user_id");
CREATE INDEX IF NOT EXISTS "live_attendances_session_idx" ON "live_attendances" ("session_id");
CREATE INDEX IF NOT EXISTS "live_attendances_user_idx" ON "live_attendances" ("user_id");
CREATE INDEX IF NOT EXISTS "live_attendances_joined_at_idx" ON "live_attendances" ("joined_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_provider_check') THEN
    ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_provider_check"
      CHECK ("provider" IN ('GOOGLE_MEET','JITSI','ZOOM','CUSTOM_EMBED'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_embed_mode_check') THEN
    ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_embed_mode_check"
      CHECK ("embed_mode" IN ('IFRAME_EMBED','PORTAL_LAUNCH'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_scope_check') THEN
    ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_scope_check"
      CHECK ("scope" IN ('GLOBAL_WEBINAR','COURSE_SPECIFIC'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_status_check') THEN
    ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_status_check"
      CHECK ("status" IN ('SCHEDULED','LIVE_NOW','ENDED','CANCELLED'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_duration_positive') THEN
    ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_duration_positive"
      CHECK ("duration_minutes" > 0);
  END IF;
END $$;
