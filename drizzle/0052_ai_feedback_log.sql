CREATE TABLE IF NOT EXISTS "ai_feedback_log" (
  "id" text PRIMARY KEY,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "conversation_id" text REFERENCES "ai_conversation"("id") ON DELETE SET NULL,
  "message_id" text,
  "rating" text NOT NULL,
  "comment" text,
  "query_text" text,
  "response_text" text,
  "sources_used" jsonb,
  "category" text,
  "locale" text NOT NULL DEFAULT 'fr',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ai_feedback_log_rating_check" CHECK ("rating" IN ('HELPFUL', 'UNHELPFUL'))
);

CREATE INDEX IF NOT EXISTS "ai_feedback_log_user_idx" ON "ai_feedback_log" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_feedback_log_rating_idx" ON "ai_feedback_log" ("rating", "created_at");
