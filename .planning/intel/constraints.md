# Architectural Constraints

## ADR 0001: Deployment & State Boundary
- source: docs/adr/0001-modular-monolith.md
- type: nfr
- content: Application must remain a single deployable Next.js monolith without distributed microservices. External state strictly confined to PostgreSQL, Redis, and Object Storage.

## ADR 0002: Media Access & Uploads Contract
- source: docs/adr/0002-private-object-storage.md
- type: api-contract
- content: Media files (PDFs, videos) must never be served via static public URLs. Access requires server authorization and short-lived signed GET URLs; admin uploads require signed PUT URLs.

## ADR 0003: Content Security Policy & Nonce Contract
- source: docs/adr/0003-csp-nonce.md
- type: protocol
- content: Strict per-request nonce generation in src/proxy.ts; strict script directives; dynamic rendering for protected/application pages.

## ADR 0004: Adapter Isolation for AI and Background Jobs
- source: docs/adr/0004-ai-and-jobs-boundaries.md
- type: api-contract
- content: All AI and background job interactions must go through explicit interface contracts (LLMProvider, EmbeddingProvider, Retriever, ConversationRepository, ToolRegistry, AIUsageMeter, JobQueue). No bespoke queues or raw vendor SDKs inside core domain services.
