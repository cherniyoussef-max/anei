-- Migration 0039: Care Session Notes, Shared Documents, and Care Access Logs

CREATE TABLE IF NOT EXISTS "specialist_session_note" (
  "id" text PRIMARY KEY,
  "assignment_id" text NOT NULL REFERENCES "specialist_student_assignment"("id") ON DELETE CASCADE,
  "specialist_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "student_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'PRIVATE',
  "session_date" timestamp with time zone NOT NULL,
  "is_addendum" boolean NOT NULL DEFAULT false,
  "parent_note_id" text REFERENCES "specialist_session_note"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "specialist_session_note_visibility_check" CHECK ("visibility" IN ('PRIVATE', 'SHARED')),
  CONSTRAINT "specialist_session_note_content_check" CHECK (char_length("content") >= 1 AND char_length("content") <= 10000)
);

CREATE INDEX IF NOT EXISTS "specialist_session_note_student_created_idx" ON "specialist_session_note" ("student_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "specialist_session_note_assignment_idx" ON "specialist_session_note" ("assignment_id");
CREATE INDEX IF NOT EXISTS "specialist_session_note_specialist_idx" ON "specialist_session_note" ("specialist_user_id");
CREATE INDEX IF NOT EXISTS "specialist_session_note_parent_note_idx" ON "specialist_session_note" ("parent_note_id");

CREATE TABLE IF NOT EXISTS "care_document" (
  "id" text PRIMARY KEY,
  "assignment_id" text NOT NULL REFERENCES "specialist_student_assignment"("id") ON DELETE CASCADE,
  "student_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "uploaded_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "conversation_id" text REFERENCES "care_conversation"("id") ON DELETE SET NULL,
  "message_id" text REFERENCES "care_message"("id") ON DELETE SET NULL,
  "file_name" text NOT NULL,
  "object_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "title" text,
  "document_type" text NOT NULL DEFAULT 'SESSION_REPORT',
  "visibility" text NOT NULL DEFAULT 'SHARED',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "care_document_visibility_check" CHECK ("visibility" IN ('PRIVATE', 'SHARED')),
  CONSTRAINT "care_document_type_check" CHECK ("document_type" IN ('SESSION_REPORT', 'ASSESSMENT', 'RESOURCE', 'CHAT_ATTACHMENT')),
  CONSTRAINT "care_document_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 26214400)
);

CREATE INDEX IF NOT EXISTS "care_document_student_created_idx" ON "care_document" ("student_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "care_document_assignment_idx" ON "care_document" ("assignment_id");

CREATE TABLE IF NOT EXISTS "care_access_log" (
  "id" text PRIMARY KEY,
  "actor_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "student_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "action" text NOT NULL DEFAULT 'READ',
  "reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "care_access_log_resource_type_check" CHECK ("resource_type" IN ('CLIENT_FILE', 'SESSION_NOTE', 'CONVERSATION', 'DOCUMENT'))
);

CREATE INDEX IF NOT EXISTS "care_access_log_student_created_idx" ON "care_access_log" ("student_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "care_access_log_actor_created_idx" ON "care_access_log" ("actor_user_id", "created_at" DESC);
