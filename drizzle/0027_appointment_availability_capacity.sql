ALTER TABLE "appointment_availability_rule" ALTER COLUMN "weekday" DROP NOT NULL;
ALTER TABLE "appointment_availability_rule" ADD COLUMN IF NOT EXISTS "specific_date" date;
ALTER TABLE "appointment_availability_rule" ADD COLUMN IF NOT EXISTS "session_type" text DEFAULT 'INDIVIDUAL' NOT NULL;
ALTER TABLE "appointment_availability_rule" ADD COLUMN IF NOT EXISTS "capacity" integer DEFAULT 1 NOT NULL;

DROP INDEX IF EXISTS "appointment_availability_rule_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_availability_rule_weekly_unique" ON "appointment_availability_rule" ("organization_id", "assigned_to_user_id", "weekday", "start_minute") WHERE "weekday" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_availability_rule_dated_unique" ON "appointment_availability_rule" ("organization_id", "assigned_to_user_id", "specific_date", "start_minute") WHERE "specific_date" IS NOT NULL;

ALTER TABLE "appointment_availability_rule" DROP CONSTRAINT IF EXISTS "appointment_availability_weekday_check";
ALTER TABLE "appointment_availability_rule" ADD CONSTRAINT "appointment_availability_recurrence_check" CHECK (("weekday" IS NOT NULL) <> ("specific_date" IS NOT NULL));
ALTER TABLE "appointment_availability_rule" ADD CONSTRAINT "appointment_availability_weekday_check" CHECK ("weekday" IS NULL OR "weekday" BETWEEN 0 AND 6);
ALTER TABLE "appointment_availability_rule" ADD CONSTRAINT "appointment_availability_session_type_check" CHECK ("session_type" IN ('INDIVIDUAL','GROUP'));
ALTER TABLE "appointment_availability_rule" ADD CONSTRAINT "appointment_availability_capacity_check" CHECK ("capacity" BETWEEN 1 AND 200);
