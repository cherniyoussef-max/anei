-- Phase 10A/10B: AI Core + RAG + Controlled Tool Registry --
-- Requires pgvector extension for embedding storage --

CREATE EXTENSION IF NOT EXISTS vector;

-- knowledge_document: source documents for RAG ingestion
CREATE TABLE "knowledge_document" (
  "id" text PRIMARY KEY,
  "organization_id" text,
  "source_type" text NOT NULL,
  "source_id" text,
  "title" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'PRIVATE',
  "content_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_visibility_check" CHECK ("knowledge_document"."visibility" in ('PUBLIC','PLATFORM','ORGANIZATION','PRIVATE'));
--> statement-breakpoint
ALTER TABLE "knowledge_document" ADD CONSTRAINT "knowledge_document_status_check" CHECK ("knowledge_document"."status" in ('PENDING','INDEXED','FAILED','ARCHIVED'));
--> statement-breakpoint
CREATE INDEX "knowledge_document_org_idx" ON "knowledge_document" ("organization_id");
--> statement-breakpoint
CREATE INDEX "knowledge_document_source_idx" ON "knowledge_document" ("source_type", "source_id");
--> statement-breakpoint
CREATE INDEX "knowledge_document_visibility_idx" ON "knowledge_document" ("visibility");

-- knowledge_chunk: text chunks with embeddings for vector search
CREATE TABLE "knowledge_chunk" (
  "id" text PRIMARY KEY,
  "document_id" text NOT NULL REFERENCES "knowledge_document"("id") ON DELETE CASCADE,
  "chunk_index" integer NOT NULL,
  "text" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "knowledge_chunk_document_idx" ON "knowledge_chunk" ("document_id", "chunk_index");
--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embedding_idx" ON "knowledge_chunk" USING hnsw ("embedding" vector_cosine_ops);

-- ai_conversation: durable AI conversations
CREATE TABLE "ai_conversation" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "organization_id" text,
  "title" text,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_status_check" CHECK ("ai_conversation"."status" in ('ACTIVE','ARCHIVED'));
--> statement-breakpoint
CREATE INDEX "ai_conversation_user_idx" ON "ai_conversation" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "ai_conversation_org_idx" ON "ai_conversation" ("organization_id", "created_at");

-- ai_message: messages within a conversation
CREATE TABLE "ai_message" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "ai_conversation"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_role_check" CHECK ("ai_message"."role" in ('USER','ASSISTANT','TOOL','SYSTEM'));
--> statement-breakpoint
CREATE INDEX "ai_message_conversation_idx" ON "ai_message" ("conversation_id", "created_at");

-- ai_tool_execution: tool execution with confirmation model
CREATE TABLE "ai_tool_execution" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "ai_conversation"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "tool_name" text NOT NULL,
  "risk_level" text NOT NULL,
  "input_hash" text NOT NULL,
  "safe_input_preview" jsonb,
  "status" text NOT NULL DEFAULT 'PROPOSED',
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "confirmed_at" timestamptz,
  "executed_at" timestamptz,
  "result_code" text,
  "error_message" text
);
--> statement-breakpoint
ALTER TABLE "ai_tool_execution" ADD CONSTRAINT "ai_tool_execution_risk_check" CHECK ("ai_tool_execution"."risk_level" in ('READ','LOW_RISK_WRITE','BUSINESS_WRITE','SENSITIVE'));
--> statement-breakpoint
ALTER TABLE "ai_tool_execution" ADD CONSTRAINT "ai_tool_execution_status_check" CHECK ("ai_tool_execution"."status" in ('PROPOSED','CONFIRMED','EXECUTED','REJECTED','FAILED','EXPIRED'));
--> statement-breakpoint
CREATE INDEX "ai_tool_execution_conversation_idx" ON "ai_tool_execution" ("conversation_id", "requested_at");
--> statement-breakpoint
CREATE INDEX "ai_tool_execution_user_status_idx" ON "ai_tool_execution" ("user_id", "status");

-- ai_usage_log: token usage and cost tracking
CREATE TABLE "ai_usage_log" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "model" text,
  "input_tokens" integer NOT NULL,
  "output_tokens" integer NOT NULL,
  "duration_ms" integer NOT NULL,
  "success" boolean NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "ai_usage_log_user_idx" ON "ai_usage_log" ("user_id", "created_at");