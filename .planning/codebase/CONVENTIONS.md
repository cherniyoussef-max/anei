# Coding Conventions

**Analysis Date:** 2026-10-09

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` (e.g., `CourseFilter.tsx`, `PageHero.tsx`).
- Utilities and services: `kebab-case.ts` (e.g., `learning-assessments.ts`, `arabic-locale.ts`).
- Tests: `[subject].test.ts` for unit/security tests, `[flow].spec.ts` for Playwright E2E.

**Functions & Methods:**
- Functions and variables: `camelCase` (e.g., `listPublishedWebinars`, `submitAssessmentAttempt`).
- React Hook functions: `useCamelCase` (e.g., `useRouter`, `useSearchParams`).

**Types & Interfaces:**
- Types, interfaces, and enums: `PascalCase` (e.g., `CatalogCourse`, `Locale`, `SessionUser`).

## Code Style

**Formatting & Linting:**
- ESLint 9 (`eslint .`) with `eslint-config-next 16.3.6`.
- TypeScript strict checking (`tsc --noEmit`).
- No unused variables or explicit `any` without documented reason.

## Import Organization

**Order:**
1. Built-in Node modules (`node:path`, `node:crypto`, `node:test`).
2. Core framework libraries (`react`, `next`, `next/image`, `next/link`).
3. External third-party packages (`zod`, `drizzle-orm`, `better-auth`).
4. Internal absolute imports via `@/*` alias (`@/server/...`, `@/components/...`, `@/lib/...`).
5. Relative local imports (`./utils`, `../types`).

**Path Aliases:**
- `@/*` maps to `src/*` (configured in `tsconfig.json`).

## Error Handling

**Patterns:**
- Mutating API route handlers wrap operations in `try/catch` and return standardized JSON error envelopes.
- Critical security checkpoints (origin checks, authentication, authorization, rate limiting) fail closed immediately with HTTP 401, 403, or 429.
- Sensitive error details and stack traces are suppressed in production HTTP responses while logged via the redacted logger.

## Logging

**Framework:**
- Structured JSON logging utility (`src/server/security/logger.ts`).
- Redacts sensitive fields (`password`, `token`, `secret`, `authorization`, `creditCard`) automatically before output.
- Avoids raw `console.log` in production code.

## Internationalization & RTL

**Guidelines:**
- Every user-facing route supports both `/fr` and `/ar` locales.
- Arabic mode enforces true RTL layout (`[dir="rtl"]`), right-aligned text, mirrored directional icons, and appropriate typography (`Cairo` font with increased line-height ~1.7).
- Translations managed through centralized dictionaries in `src/lib/i18n.ts` and `src/lib/arabic-locale.ts`.

## Function & Module Design

- Server-side code explicitly uses `server-only` where client-side leaking is dangerous.
- Client components keep state minimal, delegating heavy logic and data mutations to API routes or server actions.

---

*Convention analysis: 2026-10-09*
