-- Phase 8: lesson media provider abstraction. Additive columns only --
-- lessons.video_url/document_url keep their exact current meaning
-- (private object key resolved by signedMediaUrl()) for every existing row,
-- since media_provider defaults to 'internal'. 'youtube' (public/preview
-- lessons only) and 'cloudflare_stream' (protected paid video) are opt-in
-- per lesson via an explicit admin update. See docs/premium/ARCHITECTURE.md
-- §10, ROADMAP.md Phase 8.

ALTER TABLE "lessons" ADD COLUMN "media_provider" text DEFAULT 'internal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "media_ref" text;
--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_media_provider_check" CHECK ("lessons"."media_provider" in ('internal','youtube','cloudflare_stream'));
