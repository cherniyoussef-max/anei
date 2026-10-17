-- Migration 0047: Add category, cover_image_url, and is_featured to news_posts table
ALTER TABLE "news_posts" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'FORMATION';
ALTER TABLE "news_posts" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "news_posts" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "news_posts_featured_idx" ON "news_posts" ("is_featured");
CREATE INDEX IF NOT EXISTS "news_posts_category_idx" ON "news_posts" ("category");
