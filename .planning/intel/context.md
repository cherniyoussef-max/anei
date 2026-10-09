# Synthesized Context

## Architecture & Scalability
- source: docs/adr/0001-modular-monolith.md
ANEI combines transactional LMS and payment operations with low operational overhead today, with clean domain boundaries allowing future horizontal scaling.

## Media Privacy & Storage
- source: docs/adr/0002-private-object-storage.md
Stateless container design requires decoupling uploaded pedagogical assets and learner submissions into object storage with signed URL access control.

## Edge & Browser Security
- source: docs/adr/0003-csp-nonce.md
Mitigation of cross-site scripting (XSS) relies on strict CSP nonce propagation through proxy middleware, accepting a dynamic rendering tradeoff for protected routes.

## AI & Asynchronous Worker Boundaries
- source: docs/adr/0004-ai-and-jobs-boundaries.md
Core business domains remain decoupled from external AI APIs and background processing infrastructure until production security, authorization, and observability requirements are met.
