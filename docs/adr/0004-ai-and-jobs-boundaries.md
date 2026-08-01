# ADR 0004 — AI and background jobs remain adapter boundaries

## Context
ANEI needs future RAG/agents and asynchronous email/certificate/media processing, but adding a vendor SDK or bespoke queue into core LMS code would create coupling and reliability risk before the operational requirements are known.

## Decision
Keep explicit `LLMProvider`, `EmbeddingProvider`, `Retriever`, `ConversationRepository`, `ToolRegistry`, `AIUsageMeter` and `JobQueue` contracts. Do not enable AI in production until authorization-aware retrieval, quotas, privacy and observability exist. Do not implement a custom Redis queue; integrate a mature worker/queue implementation behind the job contract when workers are deployed.

## Consequences
The current LMS remains deployable without AI/worker infrastructure. Later providers can be added without changing course/payment/auth domain services. Long-running jobs require a separate implementation/deployment before the related feature is enabled.

## Status
Accepted.
