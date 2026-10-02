-- Migration 0036: Add access_code_version tracking to webinar registrations
ALTER TABLE "webinar_registrations" ADD COLUMN IF NOT EXISTS "access_code_version" integer NOT NULL DEFAULT 2;
