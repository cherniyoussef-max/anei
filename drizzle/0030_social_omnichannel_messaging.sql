CREATE TABLE IF NOT EXISTS "social_channel_account" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "provider" text DEFAULT 'meta' NOT NULL,
  "external_account_id" text NOT NULL,
  "account_name" text NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_channel_account_channel_check" CHECK ("channel" IN ('INSTAGRAM', 'MESSENGER')),
  CONSTRAINT "social_channel_account_status_check" CHECK ("status" IN ('ACTIVE', 'DISABLED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_channel_account_org_external_unique" ON "social_channel_account" ("organization_id", "channel", "external_account_id");
CREATE INDEX IF NOT EXISTS "social_channel_account_org_idx" ON "social_channel_account" ("organization_id");

CREATE TABLE IF NOT EXISTS "social_message" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "account_id" text REFERENCES "social_channel_account"("id") ON DELETE SET NULL,
  "contact_id" text REFERENCES "crm_contact"("id") ON DELETE SET NULL,
  "channel" text NOT NULL,
  "direction" text NOT NULL,
  "status" text DEFAULT 'QUEUED' NOT NULL,
  "provider_message_id" text,
  "local_request_id" text,
  "sender_id" text NOT NULL,
  "recipient_id" text NOT NULL,
  "sender_name" text,
  "sender_username" text,
  "sender_avatar_url" text,
  "text_preview" text,
  "media_url" text,
  "media_type" text,
  "provider_error_code" text,
  "provider_error_message" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_message_channel_check" CHECK ("channel" IN ('INSTAGRAM', 'MESSENGER')),
  CONSTRAINT "social_message_direction_check" CHECK ("direction" IN ('INBOUND', 'OUTBOUND')),
  CONSTRAINT "social_message_status_check" CHECK ("status" IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_message_provider_id_unique" ON "social_message" ("provider_message_id") WHERE "provider_message_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "social_message_local_request_unique" ON "social_message" ("organization_id", "local_request_id") WHERE "local_request_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "social_message_org_created_idx" ON "social_message" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "social_message_contact_created_idx" ON "social_message" ("contact_id", "created_at");
CREATE INDEX IF NOT EXISTS "social_message_channel_direction_idx" ON "social_message" ("channel", "direction", "status");
CREATE INDEX IF NOT EXISTS "social_message_sender_recipient_idx" ON "social_message" ("sender_id", "recipient_id");

CREATE TABLE IF NOT EXISTS "social_webhook_event" (
  "id" text PRIMARY KEY NOT NULL,
  "stable_key" text NOT NULL,
  "channel" text NOT NULL,
  "organization_id" text REFERENCES "organization"("id") ON DELETE CASCADE,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  CONSTRAINT "social_webhook_event_channel_check" CHECK ("channel" IN ('INSTAGRAM', 'MESSENGER'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_webhook_event_stable_key_unique" ON "social_webhook_event" ("stable_key");
CREATE INDEX IF NOT EXISTS "social_webhook_event_org_received_idx" ON "social_webhook_event" ("organization_id", "received_at");
