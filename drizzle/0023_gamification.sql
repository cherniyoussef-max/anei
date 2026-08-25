ALTER TABLE "user" ADD COLUMN "referred_by_code" text;

CREATE TABLE "points_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "delta" integer NOT NULL,
  "reason" text NOT NULL,
  "reference_type" text,
  "reference_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "points_ledger_reason_check" CHECK ("reason" in ('LESSON_COMPLETE','COURSE_COMPLETE','QUIZ_PASSED','REFERRAL_BONUS','REWARD_REDEMPTION','ADMIN_ADJUSTMENT'))
);
CREATE INDEX "points_ledger_user_idx" ON "points_ledger" ("user_id", "created_at");
CREATE UNIQUE INDEX "points_ledger_idempotency_unique" ON "points_ledger" ("user_id", "reason", "reference_id") WHERE "reference_id" is not null;

CREATE TABLE "reward_item" (
  "id" text PRIMARY KEY NOT NULL,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "description_fr" text DEFAULT '' NOT NULL,
  "description_ar" text DEFAULT '' NOT NULL,
  "cost_points" integer NOT NULL,
  "stock" integer,
  "cover_image" text,
  "published" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "reward_item_cost_positive" CHECK ("cost_points" > 0),
  CONSTRAINT "reward_item_stock_nonnegative" CHECK ("stock" is null or "stock" >= 0)
);

CREATE TABLE "reward_redemption" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "reward_item_id" text NOT NULL REFERENCES "reward_item"("id") ON DELETE CASCADE,
  "cost_points" integer NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "fulfilled_at" timestamptz,
  CONSTRAINT "reward_redemption_status_check" CHECK ("status" in ('PENDING','FULFILLED','CANCELLED'))
);
CREATE INDEX "reward_redemption_user_idx" ON "reward_redemption" ("user_id", "created_at");

CREATE TABLE "referral_code" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "referral_code_user_unique" UNIQUE ("user_id"),
  CONSTRAINT "referral_code_code_unique" UNIQUE ("code")
);

CREATE TABLE "referral_conversion" (
  "id" text PRIMARY KEY NOT NULL,
  "referral_code_id" text NOT NULL REFERENCES "referral_code"("id") ON DELETE CASCADE,
  "referred_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "rewarded_at" timestamptz,
  CONSTRAINT "referral_conversion_referred_user_unique" UNIQUE ("referred_user_id"),
  CONSTRAINT "referral_conversion_status_check" CHECK ("status" in ('PENDING','REWARDED'))
);
CREATE INDEX "referral_conversion_code_idx" ON "referral_conversion" ("referral_code_id");

CREATE TABLE "broadcast_notification" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "entity_id" text NOT NULL,
  "title_fr" text NOT NULL,
  "title_ar" text NOT NULL,
  "cta_url" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "recipient_count" integer,
  "sent_at" timestamptz,
  CONSTRAINT "broadcast_notification_kind_check" CHECK ("kind" in ('NEWS','WEBINAR','COURSE')),
  CONSTRAINT "broadcast_notification_status_check" CHECK ("status" in ('PENDING','SENT','FAILED'))
);

ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_event_type_check";
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_event_type_check" CHECK ("event_type" in ('WHATSAPP_TEMPLATE_SEND','AUTOMATION_TRIGGER','WHATSAPP_AI_REPLY','BROADCAST_EMAIL_SEND'));
