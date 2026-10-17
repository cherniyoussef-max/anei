-- Migration 0048: User onboarding analytics and user phone column
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text;

CREATE TABLE IF NOT EXISTS "user_onboarding_analytics" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "sub_role" text,
  "specialty" text,
  "governorate" text NOT NULL,
  "city" text NOT NULL,
  "acquisition_source" text,
  "age_group" text,
  "pathologies" text[],
  "last_login_at" timestamptz,
  "last_login_device" text,
  "last_login_locale" text,
  "login_count" integer NOT NULL DEFAULT 1,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_onboarding_analytics_user_unique" ON "user_onboarding_analytics" ("user_id");
CREATE INDEX IF NOT EXISTS "user_onboarding_analytics_category_idx" ON "user_onboarding_analytics" ("category");
CREATE INDEX IF NOT EXISTS "user_onboarding_analytics_governorate_idx" ON "user_onboarding_analytics" ("governorate");
CREATE INDEX IF NOT EXISTS "user_onboarding_analytics_source_idx" ON "user_onboarding_analytics" ("acquisition_source");
