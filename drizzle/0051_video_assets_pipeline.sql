-- Migration: 0051_video_assets_pipeline.sql
-- Creates video_assets table for Cloudflare Stream / R2 / Local hybrid zero-touch video pipeline

CREATE TABLE IF NOT EXISTS "video_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "lesson_id" text REFERENCES "lessons"("id") ON DELETE SET NULL,
  "course_id" text REFERENCES "courses"("id") ON DELETE SET NULL,
  "provider" text NOT NULL DEFAULT 'LOCAL_DEV',
  "cloudflare_uid" text NOT NULL,
  "original_filename" text NOT NULL DEFAULT '',
  "file_size_bytes" bigint NOT NULL DEFAULT 0,
  "mime_type" text NOT NULL DEFAULT 'video/mp4',
  "status" text NOT NULL DEFAULT 'UPLOADING',
  "encoding_progress_percent" integer NOT NULL DEFAULT 0,
  "duration_seconds" integer NOT NULL DEFAULT 0,
  "playback_hls_url" text,
  "playback_dash_url" text,
  "thumbnail_url" text,
  "require_signed_urls" boolean NOT NULL DEFAULT true,
  "uploaded_by_admin_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "video_assets_cloudflare_uid_unique" ON "video_assets" ("cloudflare_uid");
CREATE INDEX IF NOT EXISTS "video_assets_lesson_idx" ON "video_assets" ("lesson_id");
CREATE INDEX IF NOT EXISTS "video_assets_course_idx" ON "video_assets" ("course_id");
CREATE INDEX IF NOT EXISTS "video_assets_status_idx" ON "video_assets" ("status");
CREATE INDEX IF NOT EXISTS "video_assets_created_at_idx" ON "video_assets" ("created_at");

ALTER TABLE "video_assets" DROP CONSTRAINT IF EXISTS "video_assets_provider_check";
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_provider_check" CHECK ("provider" IN ('CLOUDFLARE_STREAM', 'CLOUDFLARE_R2', 'LOCAL_DEV'));

ALTER TABLE "video_assets" DROP CONSTRAINT IF EXISTS "video_assets_status_check";
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_status_check" CHECK ("status" IN ('UPLOADING', 'PROCESSING', 'READY', 'ERROR'));
