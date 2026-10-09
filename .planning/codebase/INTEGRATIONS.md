# External Integrations

**Analysis Date:** 2026-10-09

## APIs & External Services

**Payments:**
- Flouci (Tunisian payment gateway)
  - SDK/Client: Direct HTTP REST client (`src/server/payments/flouci.ts`)
  - Auth: `FLOUCI_PUBLIC_KEY`, `FLOUCI_PRIVATE_KEY`, `FLOUCI_BASE_URL`
- ClicToPay (SPS / Société Monétique Tunisie)
  - SDK/Client: REST client (`src/server/payments/clicktopay.ts`)
  - Auth: `CLICKTOPAY_MERCHANT_ID`, `CLICKTOPAY_API_KEY`, `CLICKTOPAY_API_URL`
- Mock Payment Gateway:
  - Internal sandbox provider for staging/test execution (`src/server/payments/mock.ts`)
  - Controlled by `PAYMENT_ALLOW_MOCK` flag (strictly rejected in production environments).

**Messaging & Social:**
- WhatsApp Cloud API & Meta Graph:
  - Direct integration (`src/server/whatsapp/`, `src/server/social/`)
  - Webhooks with HMAC SHA-256 constant-time challenge and signature verification (`src/server/social/meta-webhooks.ts`).
  - Auth: Meta webhook verification tokens and app secrets.
- n8n Automation Engine:
  - Base URL: `N8N_WEBHOOK_BASE_URL`
  - Auth tokens: `ANEI_N8N_DISPATCH_TOKEN`, `N8N_ANEI_SERVICE_TOKEN`
  - Dispatch SLAs: Managed watchdog and outbox queue (`src/server/automation/`).

**Email Delivery:**
- Nodemailer SMTP client (`src/server/services/email.ts`, `src/server/services/mailer.ts`):
  - Auth: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
  - Structured audit logging without leaking one-time tokens or sensitive URLs.

## Data Storage

**Databases:**
- PostgreSQL 16+ relational store:
  - Connection: `DATABASE_URL` via connection pooling in `src/server/db/index.ts`.
  - Client: Drizzle ORM (`drizzle-orm`) with parameterized queries.

**File Storage:**
- S3-compatible private object storage (AWS S3, MinIO, or Cloudflare R2):
  - SDK: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
  - Auth: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
  - Design: ADR 0002 — Private object storage with short-lived presigned download/upload URLs.

**Caching & Rate Limiting:**
- Redis 7+:
  - Connection: `REDIS_URL`.
  - Client: `redis` (Node Redis v4/v6 client).
  - Implementation: Distributed session cache, sliding-window rate limiters with fail-closed behavior on critical endpoints (`src/server/cache/`).

## Authentication & Identity

**Auth Provider:**
- Better Auth (`better-auth`):
  - Implementation: `src/server/auth/better-auth.ts`, `@better-auth/drizzle-adapter`.
  - Strategies: Email + Password with verification codes, Google OAuth 2.0 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
  - Session storage: Secure HTTP-only cookies, database session records, fresh session verification for admin escalation.

## Monitoring & Observability

**Error Tracking & Logs:**
- Structured JSON logger with sensitive data redaction (`src/server/security/logger.ts`).
- Sanitization of Bearer tokens, passwords, cookies, and database connection strings before writing to stdout.

## CI/CD & Deployment

**Hosting:**
- Standalone Docker/Node.js production image (`node .next/standalone/server.js`).
- Reverse proxy (Caddy / Nginx) terminating TLS and forwarding standard client headers.

## Environment Configuration

**Required Environment Variables (Production):**
- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `REDIS_URL`

**Secrets Location:**
- Stored exclusively in secure environment variables or vault; never checked into git.

## Webhooks & Callbacks

**Incoming:**
- Meta / WhatsApp Webhooks: `/api/webhooks/whatsapp`, `/api/webhooks/messenger`, `/api/webhooks/instagram` (HMAC verified).
- Payment Provider Webhooks: `/api/payments/webhook/flouci`, `/api/payments/webhook/clicktopay`.

**Outgoing:**
- n8n Automation Dispatch: outbound event triggers via secure bearer tokens.

---

*Integration audit: 2026-10-09*
