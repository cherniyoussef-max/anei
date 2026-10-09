# Architectural Decisions

## ADR 0001: Modular monolith
- source: docs/adr/0001-modular-monolith.md
- status: locked (Accepted)
- decision: Keep one deployable Next.js application with domain/service boundaries and external state in PostgreSQL/Redis/object storage.
- scope: Next.js, modular monolith, PostgreSQL, Redis, object storage, domain boundaries

## ADR 0002: Private S3-compatible media
- source: docs/adr/0002-private-object-storage.md
- status: locked (Accepted)
- decision: Use private S3-compatible storage; authorize in ANEI then issue short-lived signed URLs. Direct admin uploads use signed PUT URLs.
- scope: S3, object storage, signed URLs, media, PDFs, videos

## ADR 0003: Per-request CSP nonce
- source: docs/adr/0003-csp-nonce.md
- status: locked (Accepted)
- decision: Use a per-request nonce through src/proxy.ts, strict script directives, and dynamic rendering for protected/current application pages.
- scope: CSP, nonce, proxy.ts, XSS, security headers

## ADR 0004: AI and background jobs remain adapter boundaries
- source: docs/adr/0004-ai-and-jobs-boundaries.md
- status: locked (Accepted)
- decision: Keep explicit LLMProvider, EmbeddingProvider, Retriever, ConversationRepository, ToolRegistry, AIUsageMeter and JobQueue contracts. Do not enable AI in production until authorization-aware retrieval, quotas, privacy and observability exist. Do not implement a custom Redis queue; integrate a mature worker/queue implementation behind the job contract when workers are deployed.
- scope: AI provider, JobQueue, LLMProvider, Retriever, background workers, adapter boundaries
