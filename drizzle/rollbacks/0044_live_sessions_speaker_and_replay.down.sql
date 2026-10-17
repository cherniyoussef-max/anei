ALTER TABLE "live_sessions" DROP CONSTRAINT IF EXISTS "live_sessions_provider_check";
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_provider_check"
  CHECK ("provider" IN ('GOOGLE_MEET','JITSI','ZOOM','CUSTOM_EMBED'));
ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "replay_url";
ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "speaker_name";
