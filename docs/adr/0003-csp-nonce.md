# ADR 0003 — Per-request CSP nonce
**Status:** accepted, monitor performance

## Context
A strict CSP materially reduces XSS impact but nonce-based Next.js rendering changes static caching characteristics.

## Decision
Use a per-request nonce through `src/proxy.ts`, strict script directives, and dynamic rendering for protected/current application pages.

## Consequences
Stronger script policy with a rendering/cache tradeoff. Measure production performance; public static sections can later adopt a separate hash/static CSP strategy if needed.
