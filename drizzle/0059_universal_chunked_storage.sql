CREATE TABLE IF NOT EXISTS "uploaded_files" (
  "id" text PRIMARY KEY NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
  "file_size_bytes" bigint DEFAULT 0 NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "total_chunks" integer DEFAULT 1 NOT NULL,
  "uploaded_chunks" integer DEFAULT 0 NOT NULL,
  "is_complete" boolean DEFAULT false NOT NULL,
  "uploaded_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "duration_seconds" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "uploaded_file_chunks" (
  "id" text PRIMARY KEY NOT NULL,
  "file_id" text NOT NULL REFERENCES "uploaded_files"("id") ON DELETE CASCADE,
  "chunk_index" integer NOT NULL,
  "chunk_data" text NOT NULL,
  "chunk_size_bytes" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "uploaded_files_category_idx" ON "uploaded_files" ("category");
CREATE INDEX IF NOT EXISTS "uploaded_files_created_at_idx" ON "uploaded_files" ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "uploaded_file_chunks_file_chunk_idx" ON "uploaded_file_chunks" ("file_id", "chunk_index");
CREATE INDEX IF NOT EXISTS "uploaded_file_chunks_file_id_idx" ON "uploaded_file_chunks" ("file_id");
