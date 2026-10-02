CREATE TABLE IF NOT EXISTS "care_notification_preference" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "whatsapp_enabled" boolean NOT NULL DEFAULT false,
  "in_app_enabled" boolean NOT NULL DEFAULT true,
  "notify_on_messages" boolean NOT NULL DEFAULT true,
  "notify_on_notes" boolean NOT NULL DEFAULT true,
  "notify_on_documents" boolean NOT NULL DEFAULT true,
  "notify_on_requests" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "care_notification_preference_user_idx" ON "care_notification_preference" ("user_id");
