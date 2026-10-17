ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "speaker_name" text;
ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "replay_url" text;

ALTER TABLE "live_sessions" DROP CONSTRAINT IF EXISTS "live_sessions_provider_check";
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_provider_check"
  CHECK ("provider" IN ('GOOGLE_MEET','JITSI','ZOOM','MICROSOFT_TEAMS','CUSTOM_EMBED'));
