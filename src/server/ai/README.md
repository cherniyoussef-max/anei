# AI extension boundary

The platform deliberately has no hard dependency on an LLM vendor. Future chatbot, RAG and agent features should implement `AiProvider` and `KnowledgeRetriever` from `contracts.ts`.

Recommended production evolution:

1. Ingest approved course/resources into object storage and a background indexing queue.
2. Add `pgvector` (or a dedicated vector store only if scale requires it) for embeddings.
3. Keep authorization before retrieval: an assistant must never retrieve paid/private material the current user cannot access.
4. Run long agent jobs in workers via Redis-backed queues, not in Next.js request handlers.
5. Stream chat responses over SSE, persist conversations separately, and rate-limit per user/organization.
6. Add moderation, prompt-injection defenses, source citations, tracing, token budgets and human escalation.
