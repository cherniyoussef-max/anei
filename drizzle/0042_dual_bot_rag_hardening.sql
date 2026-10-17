-- Phase 10: Dual-Bot RAG Hardening (Public vs Teacher Bot Isolation)

-- 1. Knowledge Document visibility and language
ALTER TABLE "knowledge_document"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'fr';

ALTER TABLE "knowledge_document"
  DROP CONSTRAINT IF EXISTS "knowledge_document_visibility_check";

ALTER TABLE "knowledge_document"
  ADD CONSTRAINT "knowledge_document_visibility_check"
  CHECK ("visibility" IN ('PUBLIC', 'TEACHER', 'PLATFORM', 'ORGANIZATION', 'PRIVATE'));

ALTER TABLE "knowledge_document"
  DROP CONSTRAINT IF EXISTS "knowledge_document_language_check";

ALTER TABLE "knowledge_document"
  ADD CONSTRAINT "knowledge_document_language_check"
  CHECK ("language" IN ('fr', 'ar'));

-- 2. Knowledge Chunk visibility, language, search_vector
ALTER TABLE "knowledge_chunk"
  ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE "knowledge_chunk"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'fr';

ALTER TABLE "knowledge_chunk"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Backfill search_vector for existing chunks
UPDATE "knowledge_chunk"
  SET "search_vector" = to_tsvector('simple', coalesce("text", ''))
  WHERE "search_vector" IS NULL;

-- Trigger to maintain search_vector automatically on insert or update
CREATE OR REPLACE FUNCTION knowledge_chunk_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.text, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_chunk_tsvector ON "knowledge_chunk";
CREATE TRIGGER trg_knowledge_chunk_tsvector
BEFORE INSERT OR UPDATE OF "text" ON "knowledge_chunk"
FOR EACH ROW EXECUTE FUNCTION knowledge_chunk_tsvector_trigger();

ALTER TABLE "knowledge_chunk"
  DROP CONSTRAINT IF EXISTS "knowledge_chunk_visibility_check";

ALTER TABLE "knowledge_chunk"
  ADD CONSTRAINT "knowledge_chunk_visibility_check"
  CHECK ("visibility" IN ('PUBLIC', 'TEACHER', 'PLATFORM', 'ORGANIZATION', 'PRIVATE'));

ALTER TABLE "knowledge_chunk"
  DROP CONSTRAINT IF EXISTS "knowledge_chunk_language_check";

ALTER TABLE "knowledge_chunk"
  ADD CONSTRAINT "knowledge_chunk_language_check"
  CHECK ("language" IN ('fr', 'ar'));

-- Indexes
CREATE INDEX IF NOT EXISTS "knowledge_chunk_visibility_language_idx"
  ON "knowledge_chunk" ("visibility", "language");

CREATE INDEX IF NOT EXISTS "knowledge_chunk_search_vector_idx"
  ON "knowledge_chunk" USING gin("search_vector");
