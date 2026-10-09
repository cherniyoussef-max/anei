# Technology Stack

**Analysis Date:** 2026-10-09

## Languages

**Primary:**
- TypeScript 5.9.0 - Full-stack application code (`src/**/*.ts`, `src/**/*.tsx`, `scripts/**/*.ts`, `tests/**/*.ts`)

**Secondary:**
- JavaScript / Node.js - Utility runners and configuration scripts (`postcss.config.mjs`, `eslint.config.mjs`)
- CSS - Styling tokens and component styles (`src/app/globals.css`, `academy-home.css`, `public-theme.css`)
- SQL - Database migrations generated via Drizzle Kit (`drizzle/`)

## Runtime

**Environment:**
- Node.js `>=22.0.0 <23` (enforced via package.json `engines`)
- Execution mode: Next.js standalone server with `tsx` for scripts and test execution

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present and strictly pinned

## Frameworks

**Core:**
- Next.js 16.3.6 (App Router with server and client components)
- React 19.2.8 / React DOM 19.2.8
- Tailwind CSS 4.3.0 with `@tailwindcss/postcss`

**Data & Auth:**
- Drizzle ORM 0.45.2 (`drizzle-orm`)
- Drizzle Kit 0.31.10 (`drizzle-kit`)
- Better Auth 1.6.25 (`better-auth`, `@better-auth/drizzle-adapter`)
- pg 8.22.0 (PostgreSQL client pool)
- Redis 6.1.0 (`redis`)

**Testing:**
- Node.js native test runner (`node:test` invoked via `tsx --conditions=react-server --test`)
- Playwright 1.62.0 (`@playwright/test`) for end-to-end browser workflows
- k6 for performance and load testing (`tests/load/k6-smoke.js`)

**Build & Tooling:**
- TypeScript 5.9.0 (`tsc --noEmit`)
- ESLint 9.39.5 (`eslint .`) with `eslint-config-next 16.3.6`
- PostCSS 8.5.26
- Sharp 0.35.4 (image optimization)
- Zod 4.4.3 (runtime schema validation)

## Key Dependencies

**Critical:**
- `better-auth`: Session lifecycle, role-based access control, cookie-based credentials, multi-session management.
- `drizzle-orm` & `pg`: Relational data access, migrations, typed transactions, parameter-sanitized SQL.
- `zod`: Server-side request validation, environment configuration validation (`src/server/env.ts`).
- `redis`: Distributed session cache, sliding-window rate limiting, fail-closed security guards.

**Infrastructure & Utilities:**
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`: Private media storage and short-lived signed URLs.
- `nodemailer`: SMTP delivery for transactional emails and email verification.
- `lucide-react`: SVG icon library.
- `@modelcontextprotocol/sdk`: Model Context Protocol server integration for platform tooling.

## Configuration

**Environment:**
- Centralized validation in `src/server/env.ts` with strict Zod parsing and fail-fast assertions.
- `.env` files used for local development; sensitive credentials never committed.

**Build:**
- `next.config.ts`: Output standalone, strict CSP headers, asset domains.
- `tsconfig.json`: Strict mode enabled, path aliases (`@/*` pointing to `./src/*`).

## Platform Requirements

**Development:**
- Node.js 22.x
- Local PostgreSQL 16+ instance
- Optional local Redis 7+ instance (with memory fallback when absent in dev)

**Production:**
- Standalone container (`node .next/standalone/server.js`) behind reverse proxy.
- PostgreSQL database cluster, Redis cluster, S3-compatible private object storage.

---

*Stack analysis: 2026-10-09*
