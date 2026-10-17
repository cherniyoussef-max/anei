-- Migration: 0046_omnichannel_crm_threads_and_messages
-- Description: Unified Omnichannel CRM (WhatsApp, Instagram, Messenger) and Meta Ads Attribution pipeline

CREATE TABLE IF NOT EXISTS "crm_threads" (
  "id" text PRIMARY KEY,
  "organization_id" text REFERENCES "organization"("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "external_contact_id" text NOT NULL,
  "contact_name" text NOT NULL DEFAULT '',
  "contact_email" text,
  "contact_phone" text,
  "avatar_url" text,
  "linked_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "linked_contact_id" text REFERENCES "crm_contact"("id") ON DELETE SET NULL,
  "source_type" text NOT NULL DEFAULT 'ORGANIC',
  "ad_id" text,
  "campaign_id" text,
  "ad_headline" text,
  "ad_body" text,
  "source_url" text,
  "ctwa_clid" text,
  "meta_ad_referral" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "pipeline_stage" text NOT NULL DEFAULT 'NEW_AD_LEAD',
  "unread_count" integer NOT NULL DEFAULT 0,
  "last_message_at" timestamptz NOT NULL DEFAULT now(),
  "last_message_preview" text,
  "last_message_direction" text,
  "assigned_admin_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "internal_notes" text NOT NULL DEFAULT '',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "crm_threads_channel_check" CHECK ("channel" IN ('WHATSAPP', 'INSTAGRAM', 'MESSENGER')),
  CONSTRAINT "crm_threads_source_type_check" CHECK ("source_type" IN ('META_CLICK_TO_WHATSAPP', 'META_IG_AD', 'META_MESSENGER_AD', 'ORGANIC')),
  CONSTRAINT "crm_threads_pipeline_stage_check" CHECK ("pipeline_stage" IN ('NEW_AD_LEAD', 'QUALIFIED', 'INTERESTED_IN_COURSE', 'BOOKING_AVS_SPECIALIST', 'CONVERTED_PAID', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_threads_channel_external_org_unique" ON "crm_threads" ("channel", "external_contact_id", "organization_id");
CREATE INDEX IF NOT EXISTS "crm_threads_channel_idx" ON "crm_threads" ("channel");
CREATE INDEX IF NOT EXISTS "crm_threads_pipeline_stage_idx" ON "crm_threads" ("pipeline_stage");
CREATE INDEX IF NOT EXISTS "crm_threads_source_type_idx" ON "crm_threads" ("source_type");
CREATE INDEX IF NOT EXISTS "crm_threads_linked_user_idx" ON "crm_threads" ("linked_user_id");
CREATE INDEX IF NOT EXISTS "crm_threads_last_message_at_idx" ON "crm_threads" ("last_message_at");

CREATE TABLE IF NOT EXISTS "crm_messages" (
  "id" text PRIMARY KEY,
  "thread_id" text NOT NULL REFERENCES "crm_threads"("id") ON DELETE CASCADE,
  "direction" text NOT NULL,
  "message_type" text NOT NULL DEFAULT 'TEXT',
  "content" text NOT NULL,
  "meta_message_id" text,
  "delivery_status" text NOT NULL DEFAULT 'SENT',
  "sent_by_admin_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "crm_messages_direction_check" CHECK ("direction" IN ('INBOUND', 'OUTBOUND')),
  CONSTRAINT "crm_messages_delivery_status_check" CHECK ("delivery_status" IN ('SENT', 'DELIVERED', 'READ', 'FAILED')),
  CONSTRAINT "crm_messages_type_check" CHECK ("message_type" IN ('TEXT', 'TEMPLATE', 'AUDIO', 'IMAGE', 'DOCUMENT', 'INTERACTIVE_BUTTON'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_messages_meta_id_unique" ON "crm_messages" ("meta_message_id");
CREATE INDEX IF NOT EXISTS "crm_messages_thread_idx" ON "crm_messages" ("thread_id", "created_at");

CREATE TABLE IF NOT EXISTS "crm_lead_attribution" (
  "id" text PRIMARY KEY,
  "thread_id" text NOT NULL REFERENCES "crm_threads"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "channel" text NOT NULL,
  "source_type" text NOT NULL,
  "ad_id" text,
  "campaign_id" text,
  "ad_headline" text,
  "ad_body" text,
  "source_url" text,
  "ctwa_clid" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "crm_lead_attribution_thread_idx" ON "crm_lead_attribution" ("thread_id");
CREATE INDEX IF NOT EXISTS "crm_lead_attribution_ad_idx" ON "crm_lead_attribution" ("ad_id");
CREATE INDEX IF NOT EXISTS "crm_lead_attribution_campaign_idx" ON "crm_lead_attribution" ("campaign_id");
