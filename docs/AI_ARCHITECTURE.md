# AI architecture

AI is disabled by default and must remain outside the core authorization boundary.

```text
User -> AI API -> auth/quota -> authorized retrieval -> LLM gateway -> response
                              -> tool registry (each tool re-authorizes)
```

Provider-neutral interfaces should cover LLM, embeddings, retrieval, conversations, tool registry and usage metering. Evaluate PostgreSQL + pgvector before adding a separate vector database.

## Security
Treat retrieved documents and user prompts as untrusted. Defend against prompt injection, indirect prompt injection, SSRF/tool misuse, data exfiltration and cross-user retrieval leakage. Authorization filters run before retrieval/tool execution; the model never decides permissions. Enforce token/cost/concurrency/time limits and privacy-aware logs.

## Code boundaries already present

`src/server/ai/contracts.ts` defines `LLMProvider`, `EmbeddingProvider`, `Retriever`, `ConversationRepository`, `ToolRegistry` and `AIUsageMeter`. `src/server/queue/contracts.ts` defines the durable-job boundary for ingestion and other asynchronous workloads. No vendor is enabled by default.

The hard rule is: the retriever filters by authorization before private chunks reach an LLM, and every agent tool authorizes its own action independently of the model.
