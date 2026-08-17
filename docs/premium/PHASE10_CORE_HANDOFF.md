# Phase 10A/10B Handoff — AI Core + RAG + Controlled Tool Registry

## Scope implemented

- AI core interfaces: `LLMProvider`, `EmbeddingProvider`, `Retriever`, `ConversationRepository`, `ToolRegistry`, `AIUsageMeter`
- Provider-neutral LLM/embedding abstractions with test fakes (OpenAI-compatible)
- PostgreSQL-backed conversation storage with tenant isolation
- RAG retrieval with pgvector (production) / in-memory cosine similarity (test)
- Controlled tool registry with 7 initial tools (4 READ, 3 BUSINESS_WRITE)
- Tool authorization, confirmation model, audit trail
- Tool confirmation/rejection API endpoints
- MCP foundation registry (local-only, reuses controlled tools)
- n8n foundation interfaces (contracts only, no runtime)
- Knowledge ingestion service with content-hash deduplication
- Tenant-isolated RAG retrieval (Org A never sees Org B private chunks)
- Prompt injection defenses: structural isolation, tool authorization as hard boundary

## Architecture

```
AI Runtime
  ├── ConversationRepository (PostgreSQL)
  ├── LLMProvider (OpenAI-compatible, test fake)
  ├── EmbeddingProvider (OpenAI, test fake)
  ├── Retriever (pgvector + tenant filters)
  └── ToolRegistry
        ├── READ tools (auto-authorized): search_knowledge, get_my_courses, list_my_appointments, get_course_details
        ├── BUSINESS_WRITE tools (confirmation required): create_appointment, reschedule_appointment, send_whatsapp_template
        └── Execution engine: authorization → confirmation → execution → audit
```

## Data Model

New tables (migration 0014):
- `knowledge_document` — source documents with visibility (PUBLIC/PLATFORM/ORGANIZATION/PRIVATE)
- `knowledge_chunk` — text chunks with embeddings (pgvector in prod, jsonb in test)
- `ai_conversation` — durable conversations, user-scoped
- `ai_message` — messages (USER/ASSISTANT/TOOL/SYSTEM roles)
- `ai_tool_execution` — confirmation model (PROPOSED→CONFIRMED→EXECUTED|REJECTED|FAILED|EXPIRED)
- `ai_usage_log` — token usage tracking with daily/monthly quotas

Indexes: vector HNSW on embeddings, tenant-filtered retrieval paths

## Security Invariants

- LLM never decides authorization — every tool re-checks permissions
- Tool input validated against strict Zod schemas
- Business tools require explicit user confirmation (10 min TTL)
- Confirmation binds to input hash — tampered actions rejected
- Authorization re-checked at execution time (not just proposal)
- RAG retrieval applies tenant filters BEFORE vector search
- No secrets/OTPs/invitation tokens in prompts or tool outputs
- Tool outputs bounded to minimal necessary fields
- Hard limit: 3 tool iterations per chat turn

## MCP / n8n Foundation

- `src/server/mcp/registry.ts` — maps MCP tools to controlled tools, confirmation-aware
- `src/server/automation/contracts.ts` — typed workflow interfaces, no runtime yet
- Both layers reuse `src/server/tools/registry.ts` — no duplicated business logic

## Migration

`drizzle/0014_ai_core_rag_tools.sql` — additive, requires pgvector extension
`drizzle/0014_ai_core_rag_tools_test.sql` — test variant using jsonb embeddings

Previous migrations 0000–0013 untouched.

## Tests / Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| `test:unit` | 159 | 159 | 0 |
| `test:security` | 3 | 3 | 0 |
| `test:integration` (run 1) | 181 | 181 | 0 |
| `test:integration` (run 2) | 181 | 181 | 0 |

Key integration tests:
- RAG tenant isolation (Org A cannot retrieve Org B chunks)
- Tool authorization enforced (insufficient role → denied)
- Business tools require confirmation (never auto-execute)
- Confirmation binds to input hash (tampered actions rejected)
- Cross-user confirmation rejected
- Prompt injection cannot bypass tool confirmation
- Second test run passes (no leftover state)

## Known Debt / Deferred

- No dead-letter queue for failed tool executions
- Worker observability: log-only (cycle counts), no metrics export
- n8n runtime not deployed; workflow registry is interface-only
- Remote MCP transport not implemented (local-only)
- Embedding model versioning strategy not implemented
- No fine-tuning pipeline
- No autonomous agent loops (max 3 tool iterations hardcoded)

## Next Phase 10 Milestone

10C: Controlled tool expansion (enrollment, CRM notes, tags)
10D: MCP remote transport (stdio/HTTP) + OAuth
10E: n8n runtime deployment + workflow allowlist
10F: Human approval workflows for SENSITIVE tools
10G: Evaluations / prompt injection benchmarks