CREATE TABLE IF NOT EXISTS "appointment_availability_rule" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "assigned_to_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "weekday" integer NOT NULL,
  "start_minute" integer NOT NULL,
  "end_minute" integer NOT NULL,
  "duration_minutes" integer DEFAULT 60 NOT NULL,
  "type" text DEFAULT 'FOLLOW_UP' NOT NULL,
  "timezone" text DEFAULT 'Africa/Tunis' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "appointment_availability_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  CONSTRAINT "appointment_availability_minutes_check" CHECK ("start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" > "start_minute"),
  CONSTRAINT "appointment_availability_duration_check" CHECK ("duration_minutes" BETWEEN 15 AND 240),
  CONSTRAINT "appointment_availability_type_check" CHECK ("type" IN ('ASSESSMENT','INFO_MEETING','FOLLOW_UP','OTHER')),
  CONSTRAINT "appointment_availability_timezone_check" CHECK ("timezone" = 'Africa/Tunis')
);
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_availability_rule_unique" ON "appointment_availability_rule" ("organization_id", "assigned_to_user_id", "weekday", "start_minute");
CREATE INDEX IF NOT EXISTS "appointment_availability_rule_org_active_idx" ON "appointment_availability_rule" ("organization_id", "active");
