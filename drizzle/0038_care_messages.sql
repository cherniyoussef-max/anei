-- Migration 0038: Care messaging table and indexes
CREATE TABLE IF NOT EXISTS "care_message" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "care_conversation"("id") ON DELETE CASCADE,
  "sender_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "content" text NOT NULL,
  "status" text NOT NULL DEFAULT 'SENT',
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "care_message_status_check" CHECK ("status" IN ('SENT', 'DELIVERED', 'READ')),
  CONSTRAINT "care_message_content_length_check" CHECK (char_length("content") >= 1 AND char_length("content") <= 4000)
);

CREATE INDEX IF NOT EXISTS "care_message_conversation_created_idx"
  ON "care_message" ("conversation_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "care_message_sender_idx"
  ON "care_message" ("sender_user_id");
