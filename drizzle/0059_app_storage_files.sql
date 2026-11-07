-- Migration: 0059_app_storage_files.sql
-- Native resilient storage for high-capacity video and document uploads on Vercel

CREATE TABLE IF NOT EXISTS "app_storage_files" (
  "id" text PRIMARY KEY NOT NULL,
  "object_key" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "filename" text NOT NULL,
  "content_type" text NOT NULL DEFAULT 'application/octet-stream',
  "file_size" bigint NOT NULL DEFAULT 0,
  "data" bytea NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_storage_files_object_key_unique" ON "app_storage_files" ("object_key");
CREATE INDEX IF NOT EXISTS "app_storage_files_category_idx" ON "app_storage_files" ("category");
CREATE INDEX IF NOT EXISTS "app_storage_files_created_at_idx" ON "app_storage_files" ("created_at");

CREATE TABLE IF NOT EXISTS "app_storage_chunks" (
  "id" text PRIMARY KEY NOT NULL,
  "upload_id" text NOT NULL,
  "chunk_index" integer NOT NULL,
  "total_chunks" integer NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "app_storage_chunks_upload_idx" ON "app_storage_chunks" ("upload_id", "chunk_index");
