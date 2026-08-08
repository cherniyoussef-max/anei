# ANEI Platform - Comprehensive ChatGPT Context

> **Instructions for ChatGPT / AI Assistant:** Read this entire document carefully. It contains the complete architectural blueprint, business rules, design guidelines, database schema patterns, and technical stack for the ANEI (Académie Nationale de l'Éducation Inclusive) platform. Treat this as the definitive source of truth for all future code generation, debugging, and architectural advice for this project.

---

## 1. Project Overview & Business Objectives

**Project Name:** ANEI Platform (Version 3.4.0)
**Target Audience:** Educators, AVS (Auxiliaires de Vie Scolaire) professionals, specialists, and families in Tunisia and the wider Arabic/French-speaking regions.
**Core Objective:** To provide a premium, institutional-grade bilingual platform that offers professional learning (courses/webinars), verified digital certificates, access to an AVS directory, and educational resources. 

**The Three Distinct Product Experiences:**
1. **Public Website:** Editorial, human, and trustworthy. Features a course catalog, digital library, AVS directory, news, and webinars. (Must support perfect RTL Arabic and LTR French).
2. **Learner LMS (Dashboard):** Focused, calm, and productive. Features a course player, module/lesson navigation, progress tracking, and certificate access.
3. **Admin Console:** Enterprise-grade, dense, and precise. Features content CRUD, paginated user/order tables, payment reconciliation, and an immutable security audit log. *Visually isolated from the public site.*

---

## 2. Technology Stack & Architecture

ANEI is built as a **Bounded Modular Monolith**. This ensures transactional consistency (especially for payments and learning progress) while allowing for horizontal scaling of the web tier.

### Core Stack
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (Strict Mode). Uses React Server Components (RSC) by default; Client components are restricted to interactive islands (forms, video player, session controls).
- **Styling:** Tailwind CSS 4 with a strictly enforced custom semantic design system (`design-system/anei/MASTER.md`). No extra UI/animation libraries (like Framer Motion) are used to keep the bundle lean.
- **Database:** PostgreSQL (Source of Truth).
- **ORM:** Drizzle ORM. Migrations are strictly versioned SQL files (in `drizzle/`) managed by a custom migration runner with advisory locks.
- **Authentication:** Better Auth (Email/Password, Email Verification, Password Reset, Google OAuth, Session Revocation).
- **Infrastructure Services:**
  - **Redis:** Used for distributed sliding-window rate limiting. Not used as authoritative storage.
  - **S3-Compatible Storage:** (AWS S3, MinIO, Cloudflare R2). Used for private media. The app generates short-lived signed GET URLs for downloads/video and presigned POST policies for admin uploads.
  - **SMTP:** Nodemailer (Mailpit for local testing).

---

## 3. Directory Structure & Bounded Contexts

The codebase is organized by domain rather than purely by technical function.

```text
anei-platform-production-v3.3.0/
├── .agents/                   # AI Agent skills and guidelines
├── design-system/             # ANEI UI source of truth and page-level overrides
├── docs/                      # Extensive markdown documentation (Architecture, Threat Model, etc.)
├── drizzle/                   # Immutable, versioned SQL migrations (0000_initial.sql, etc.)
├── public/media/              # Local documentary-style photography (No third-party image CDN needed)
├── scripts/                   # CLI scripts (migrate, seed, bootstrap-admin, security-audit)
└── src/
    ├── app/                   # Next.js App Router
    │   ├── [locale]/          # i18n routing (fr, ar)
    │   │   ├── admin/         # Admin routes (protected)
    │   │   ├── dashboard/     # Learner LMS routes (protected)
    │   │   └── ...            # Public routes (about, contact, formations, etc.)
    │   └── api/               # Serverless API Route Handlers
    ├── components/            # Shared React components (UI, layout, interactive)
    ├── lib/                   # Shared utilities (i18n, visual asset maps, auth client)
    ├── modules/               # Core Business Domains (The Modular Monolith)
    │   ├── account/           # Profile, preferences, session management
    │   ├── admin/             # Operational views, audit logs
    │   ├── auth/              # Authentication flows
    │   ├── commerce/          # Orders, Payments (Flouci, ClicToPay), Entitlements
    │   ├── interactive/       # Video players, interactive course elements
    │   ├── layout/            # Headers, footers, sidebars
    │   ├── learning/          # Course progress, modules, certificates
    │   ├── sections/          # Large page sections (Hero, Feature grids)
    │   └── ui/                # Base design system components (Buttons, Cards, Inputs)
    └── server/                # Backend Infrastructure Services
        ├── auth/              # Better Auth configuration
        ├── db/                # Drizzle schema and connection pool
        ├── payments/          # Payment gateway adapters
        ├── security/          # Rate limiting, CSRF guards, request validation
        └── storage/           # S3 client and presigned URL generators
```

---

## 4. Security & Data Flow Principles

**Threat Model & Mitigations:**
1. **Never Trust the Browser:** The client is untrusted. Playback position does not dictate course completion; the server derives completion status from persistent progress rules. Client-submitted prices are ignored; the server fetches authoritative prices from PostgreSQL.
2. **Mutation Guards:** All custom state-changing API routes (POST, PATCH, DELETE) undergo:
   - **Same-Origin / Fetch-Metadata Checks:** Rejects cross-origin requests.
   - **Bounded Body Parsing:** Rejects oversized JSON payloads.
   - **Zod Validation:** Strict runtime type checking at the boundary.
   - **Rate Limiting:** Redis-backed protection against brute force and abuse.
3. **Database Integrity:** SQL injection is mitigated via Drizzle's parameterized queries. The codebase actively audits against the use of `sql.raw()`. Database-level `CHECK` constraints (e.g., progress between 0-100, positive prices) enforce business rules even if app logic fails.
4. **Role-Based Access Control (RBAC):** Users are `USER`, `ADMIN`, or `SUPER_ADMIN`. Admin routes verify roles server-side. Sensitive role elevations require `SUPER_ADMIN`. The final `SUPER_ADMIN` cannot be demoted.

---

## 5. Commerce & Payment Flow (Strict Invariant)

**The Payment Lifecycle:**
1. **Intent:** Authenticated user initiates purchase.
2. **Pricing:** Server resolves the published item and its authoritative price in TND (stored as integer *millimes*).
3. **Order Creation:** A pending local order is created with an idempotency key.
4. **Checkout:** User is redirected to the provider (Flouci, ClicToPay, or local Mock).
5. **Webhook/Return:** Provider redirects user back or sends a webhook.
6. **Server-to-Server Verification:** The server calls the provider's API to verify the transaction status and amount. **A browser success URL parameter is NEVER trusted.**
7. **Atomic Commit:** Inside a single PostgreSQL transaction:
   - Order status is marked `paid`.
   - Payment record is created.
   - User is granted the `Entitlement` (access to the course/resource).
   - Audit log and notifications are triggered.

---

## 6. UI/UX & Design Guidelines (Crucial for Frontend Tasks)

When writing frontend code, strictly adhere to these rules from the ANEI brand guidelines:
- **Tone:** Professional, institutional, premium, human. NOT a generic SaaS startup or cartoonish app.
- **Colors & Surfaces:** Use institutional cobalt/navy blue, neutral slate, and warm neutral surfaces. Avoid random gradients, glowing buttons, or heavy glassmorphism.
- **Typography:** Hierarchy is paramount. Use strong, readable text. Ensure Arabic text has perfect RTL support without breaking layouts.
- **Components:** Avoid excessive rounding (no pill-shaped giant cards). Use subtle shadows only for elevation.
- **Motion:** Restrained. Use for meaningful transitions (dialogs, menus, hover states) and respect `prefers-reduced-motion`.
- **Accessibility:** Target WCAG 2.2 AA. Ensure semantic HTML, visible focus states, ARIA labels where necessary, and minimum 44px touch targets.
- **Responsiveness:** Do not just shrink desktop layouts. Design deliberately for 375px, 768px, 1024px, 1280px, and 1440px.

---

## 7. Development & Deployment

### Local Setup
1. Copy `.env.example` to `.env` (Set `PAYMENT_ALLOW_MOCK=true`, `ENABLE_GOOGLE_AUTH=false`, `STORAGE_PROVIDER=local` for initial dev).
2. Start infrastructure: `docker compose up -d` (Spins up Postgres, Redis, Mailpit).
3. Migrate & Seed: `npm run db:migrate` then `npm run db:seed`.
4. Run App: `npm run dev`.

### Testing & Quality Gates
- **Typecheck & Lint:** `npm run typecheck`, `npm run lint`.
- **Unit & Security Tests:** `npm run test` (Uses native Node `--test`).
- **E2E Tests:** `npm run test:e2e` (Playwright).
- **Security Audit:** `npm run security:audit` (Scans for dangerous patterns like `eval`, `sql.raw`).
- **All-in-One Check:** `npm run check`.

### Production Deployment Rules
- Application builds as a Next.js `standalone` container.
- Production environment variables **fail-closed**. If `NODE_ENV=production`, the app will refuse to start if mock payments are enabled, demo seeders are run, or fake SMTP/Storage configurations are detected.
- Never use `drizzle-kit push` in production. Always use the migration runner (`npm run db:migrate`).

---

## 8. Areas for Improvement / Project Roadmap

If asked to improve the platform, focus on these pending milestones:
1. **Assessment Engine:** Add a quizzing/assessment module that users must pass before a certificate is generated, moving from "view-based" to "verified mastery".
2. **PDF Certificate Generation:** Implement an asynchronous server-side PDF generator (e.g., using React-PDF or Puppeteer in a worker) to replace basic HTML certificates.
3. **Advanced Admin Metrics:** Build richer data visualization in the Admin console (using simple line/bar charts without heavy dependencies) for enrollment trends and revenue.
4. **Queue Worker:** Extract heavy tasks (email sending, media processing, PDF generation) from the synchronous request lifecycle into a durable Redis-backed queue system.
5. **AI Integration (Phase 5):** Carefully implement the RAG/AI architecture detailed in `docs/AI_ARCHITECTURE.md`. This requires strict authorization filtering *before* context is passed to the LLM, as well as cost/quota controls.

---
**End of Context Document.** You now have a complete understanding of the ANEI platform.
