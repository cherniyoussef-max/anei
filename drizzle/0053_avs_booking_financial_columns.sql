ALTER TABLE "avs_booking_requests"
  ADD COLUMN IF NOT EXISTS "amount_millimes" integer NOT NULL DEFAULT 35000,
  ADD COLUMN IF NOT EXISTS "platform_fee_millimes" integer NOT NULL DEFAULT 3500,
  ADD COLUMN IF NOT EXISTS "avs_payout_millimes" integer NOT NULL DEFAULT 31500,
  ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'HELD_IN_ESCROW',
  ADD COLUMN IF NOT EXISTS "payment_method" text,
  ADD COLUMN IF NOT EXISTS "payment_reference" text,
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "escrow_released_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refunded_at" timestamp with time zone;
