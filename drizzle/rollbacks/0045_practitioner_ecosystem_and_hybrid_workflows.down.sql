-- Rollback: 0045_practitioner_ecosystem_and_hybrid_workflows

DROP INDEX IF EXISTS "webinars_course_idx";
DROP INDEX IF EXISTS "webinars_category_idx";
ALTER TABLE "webinars"
  DROP COLUMN IF EXISTS "course_id",
  DROP COLUMN IF EXISTS "category";

ALTER TABLE "courses"
  DROP COLUMN IF EXISTS "qualifying_target_category",
  DROP COLUMN IF EXISTS "qualifying_target_type",
  DROP COLUMN IF EXISTS "qualifies_for_professional_promotion";

DROP INDEX IF EXISTS "live_sessions_category_idx";
ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "category";

DROP INDEX IF EXISTS "avs_booking_payment_mode_idx";
DROP INDEX IF EXISTS "avs_booking_live_session_idx";
ALTER TABLE "avs_booking_requests"
  DROP COLUMN IF EXISTS "escrow_status",
  DROP COLUMN IF EXISTS "practitioner_notes",
  DROP COLUMN IF EXISTS "live_session_id",
  DROP COLUMN IF EXISTS "net_practitioner_payout_millimes",
  DROP COLUMN IF EXISTS "platform_commission_percent",
  DROP COLUMN IF EXISTS "payment_mode";

DROP TABLE IF EXISTS "practitioner_promotions";

ALTER TABLE "user" DROP COLUMN IF EXISTS "professional_post_status";

DROP INDEX IF EXISTS "avs_category_idx";
DROP INDEX IF EXISTS "avs_directory_type_idx";
ALTER TABLE "avs_profiles"
  DROP COLUMN IF EXISTS "category_details",
  DROP COLUMN IF EXISTS "availability_regime",
  DROP COLUMN IF EXISTS "online_visio_price_millimes",
  DROP COLUMN IF EXISTS "in_person_price_millimes",
  DROP COLUMN IF EXISTS "consultation_duration_minutes",
  DROP COLUMN IF EXISTS "university_degree",
  DROP COLUMN IF EXISTS "license_or_order_number",
  DROP COLUMN IF EXISTS "workplace_address",
  DROP COLUMN IF EXISTS "workplace_name",
  DROP COLUMN IF EXISTS "whatsapp_phone",
  DROP COLUMN IF EXISTS "show_phone_publicly",
  DROP COLUMN IF EXISTS "contact_phone",
  DROP COLUMN IF EXISTS "category",
  DROP COLUMN IF EXISTS "directory_type";
