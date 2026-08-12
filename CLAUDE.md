# ANEI Platform

Production Next.js full-stack LMS. Source code is authoritative; documentation may lag behind the implementation.

## Core stack

- Next.js / React / TypeScript
- PostgreSQL with Drizzle ORM
- Better Auth
- Redis
- Private S3-compatible storage
- Payment integrations including Flouci and mock/local flows

## Development workflow

- For cross-module or unfamiliar-code questions, use Graphify before broad Grep/Glob exploration.
- Keep Graphify queries focused. Prefer repository symbols and concepts over broad natural-language questions.
- After Graphify orientation, read only the source files needed to verify the result.
- Do not inspect `.agents/`, `.claude/`, or `graphify-out/` unless the task specifically concerns development tooling.
- Treat current source code and tests as authoritative when documentation conflicts with implementation.
- Reuse existing architecture, utilities, services, validation, and dependencies before adding new abstractions.
- Keep changes scoped to the requested task.
- Do not add dependencies without a concrete need.

## Important architecture

- Authentication configuration: `src/server/auth/index.ts`
- Session helpers: `src/server/auth/session.ts`
- Admin authentication helpers: `src/server/auth/admin.ts`
- Admin permissions: `src/modules/admin/domain/permissions.ts`
- Database client: `src/server/db/index.ts`
- Database schema: `src/server/db/schema.ts`
- Environment configuration: `src/server/env.ts`
- Payment implementation: `src/server/payments/`

## Security invariants

- Preserve authentication and authorization checks when changing protected flows.
- Preserve origin/mutation validation and rate limiting on protected mutation endpoints.
- Do not trust browser payment-success redirects as proof of payment; retain server-side verification.
- Preserve private-object authorization and signed URL behavior for protected storage.
- Do not weaken validation, auditing, or database constraints to simplify an implementation.

## Verification

After modifying code, run only the checks relevant to the changed area first:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- targeted tests when available
- `npm run build` for changes that can affect production compilation

Inspect `git diff` before declaring a task complete.

For database/schema changes, inspect the existing Drizzle schema and migration conventions before creating migrations.

## Graphify

A project knowledge graph is stored under `graphify-out/`.

- Prefer `graphify query "<focused question>" --budget 800` for codebase orientation.
- Use `graphify explain "<symbol>"` for one concept.
- Use `graphify path "<A>" "<B>"` to inspect relationships.
- After meaningful code changes, use `graphify update .` when the graph needs refreshing.
- Do not read `graphify-out/graph.json` directly.

