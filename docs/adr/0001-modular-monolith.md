# ADR 0001 — Modular monolith
**Status:** accepted

## Context
ANEI needs transactional LMS/payment behavior and a small engineering surface today, while supporting horizontal application scaling later.

## Decision
Keep one deployable Next.js application with domain/service boundaries and external state in PostgreSQL/Redis/object storage.

## Alternatives
Microservices now: rejected due operational complexity and distributed transaction costs without measured need.

## Consequences
Simple deployment/transactions; domains can be extracted later only if load/team ownership warrants it.
