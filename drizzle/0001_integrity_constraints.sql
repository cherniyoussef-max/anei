-- Defense-in-depth constraints. Application validation remains mandatory.
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("role" IN ('USER','ADMIN','SUPER_ADMIN'));
ALTER TABLE "user" ADD CONSTRAINT "user_locale_check" CHECK ("locale" IN ('fr','ar'));
ALTER TABLE "user" ADD CONSTRAINT "user_profile_type_check" CHECK ("profile_type" IN ('learner','teacher','avs','parent','specialist','institution'));

ALTER TABLE "courses" ADD CONSTRAINT "courses_duration_positive" CHECK ("duration_minutes" > 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_nonnegative" CHECK ("price_millimes" >= 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_level_check" CHECK ("level" IN ('beginner','intermediate','advanced'));
ALTER TABLE "courses" ADD CONSTRAINT "courses_mode_check" CHECK ("mode" IN ('online','hybrid','onsite'));

ALTER TABLE "lessons" ADD CONSTRAINT "lessons_position_positive" CHECK ("position" > 0);
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_duration_nonnegative" CHECK ("duration_seconds" >= 0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "certificates" GROUP BY "user_id", "course_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add certificate_user_course_unique: duplicate certificate rows exist for a user/course';
  END IF;
END $$;
CREATE UNIQUE INDEX "certificate_user_course_unique" ON "certificates" ("user_id","course_id");

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollment_progress_range" CHECK ("progress_percent" BETWEEN 0 AND 100);
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollment_status_check" CHECK ("status" IN ('active','completed','cancelled'));
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_watched_nonnegative" CHECK ("watched_seconds" >= 0);

ALTER TABLE "resources" ADD CONSTRAINT "resources_price_nonnegative" CHECK ("price_millimes" >= 0);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "purchases" WHERE "resource_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make purchases.resource_id NOT NULL: null resource purchases must be reviewed first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "purchases" GROUP BY "user_id", "resource_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add purchases_user_resource_unique: duplicate resource entitlements must be reviewed first';
  END IF;
END $$;
ALTER TABLE "purchases" ALTER COLUMN "resource_id" SET NOT NULL;
CREATE UNIQUE INDEX "purchases_user_resource_unique" ON "purchases" ("user_id","resource_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_nonnegative" CHECK ("amount_millimes" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_check" CHECK ("currency" = 'TND');
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("status" IN ('pending','paid','failed','expired','cancelled'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_check" CHECK ("provider" IN ('mock','flouci','clicktopay','free'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_item_type_check" CHECK ("item_type" IN ('course','resource'));

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_nonnegative" CHECK ("amount_millimes" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("status" IN ('pending','paid','failed','expired','cancelled'));
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_check" CHECK ("provider" IN ('mock','flouci','clicktopay'));

ALTER TABLE "webinars" ADD CONSTRAINT "webinars_duration_positive" CHECK ("duration_minutes" > 0);
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_status_check" CHECK ("status" IN ('new','read','closed'));
