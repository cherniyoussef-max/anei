# Codebase Structure

**Analysis Date:** 2026-10-09

## Directory Layout

```text
anei-platform-production/
├── drizzle/                     # Drizzle SQL migration files
├── docs/                        # Architectural Decision Records (ADRs) and documentation
│   └── adr/                     # Accepted architectural decisions (0001 to 0004)
├── public/                      # Static assets, branding, and images
│   ├── brand/                   # Official emblems, logos, and watermarks
│   └── media/                   # Course visuals and domain photography
├── scripts/                     # Operational scripts (seed, migration, audit, verify)
├── src/                         # Application source code
│   ├── app/                     # Next.js App Router root
│   │   ├── api/                 # Backend REST and webhook route handlers
│   │   ├── [locale]/            # Localized application routes (/fr, /ar)
│   │   │   ├── (site)/          # Public institutional website experience
│   │   │   ├── (learner)/       # Learner LMS and course workspace
│   │   │   └── admin/           # Admin enterprise operations console
│   │   ├── globals.css          # Global styling tokens and layout rules
│   │   └── layout.tsx           # Root HTML layout with font bindings
│   ├── components/              # Shared React UI components
│   │   ├── auth/                # Sign-in, sign-up, account action modals
│   │   ├── commerce/            # Resource catalog and purchase widgets
│   │   ├── interactive/         # Filters, booking modals, forms
│   │   ├── layout/              # Header, footer, navigation shells
│   │   ├── learning/            # Course player, assessment player, quizzes
│   │   └── ui/                  # Primitives (Icon, Button, Modal, PageHero)
│   ├── lib/                     # Client/shared utilities (i18n, visuals, formatting)
│   ├── modules/                 # Modular domain modules (learning, admin, crm)
│   ├── server/                  # Core backend infrastructure & services
│   │   ├── auth/                # Better Auth configuration and RBAC
│   │   ├── db/                  # Drizzle database schemas and pool client
│   │   ├── payments/            # Flouci, ClicToPay, and mock payment providers
│   │   ├── security/            # Rate limiting, origin checking, logger
│   │   ├── services/            # Course, assessment, user domain services
│   │   └── storage/             # S3 presigned URL generators
│   └── types/                   # Shared TypeScript type definitions
└── tests/                       # Automated test suites
    ├── e2e/                     # Playwright end-to-end tests
    ├── integration/             # Integration workflows
    ├── security/                # Security regression tests
    └── unit/                    # Unit tests for domain logic
```

## Directory Purposes

**`src/app/[locale]/(site)/`:**
- Public institutional experience (`Accueil`, `Formations`, `Bibliothèque`, `Trouver un AVS`, `Webinaires`, `Actualités`, `Contact`).
- Key files: `page.tsx`, `formations/page.tsx`, `bibliotheque/page.tsx`, `avs/page.tsx`.

**`src/app/[locale]/(learner)/`:**
- Focused, distraction-free LMS experience for enrolled students and educators.
- Key files: `apprendre/[slug]/page.tsx`, `dashboard/page.tsx`.

**`src/app/[locale]/admin/`:**
- Enterprise administration console with dense data tables, user support, and moderation tools.
- Key files: `admin/users/page.tsx`, `admin/assessments/page.tsx`.

**`src/server/db/`:**
- Relational data modeling and schema declarations.
- Key files: `schema.ts`, `index.ts`.

## Key File Locations

**Entry Points:**
- `src/proxy.ts`: Reverse proxy middleware intercepting requests for CSP nonces, origin validation, and security headers.
- `src/app/layout.tsx`: Root HTML layout injecting Cairo, Inter, and Fraunces fonts.
- `src/app/[locale]/(site)/page.tsx`: FROZEN public homepage.

**Configuration:**
- `src/server/env.ts`: Strict Zod schema validating environment variables on startup.
- `next.config.ts`: Next.js standalone output and asset configuration.

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `PageHero.tsx`, `SiteHeader.tsx`).
- Utility files & routes: `kebab-case.ts` (e.g., `arabic-locale.ts`, `safe-redirect.ts`).
- Route handlers: `route.ts`.
- Page views: `page.tsx`.

**Directories:**
- Route segments: `kebab-case` or Next.js route groups `(group-name)`.
- Domain modules: `kebab-case` under `src/modules/`.

## Where to Add New Code

**New Public Feature / Page:**
- Create localized route under `src/app/[locale]/(site)/[feature-name]/page.tsx`.
- Add interactive client components under `src/components/interactive/`.
- Ensure styling respects `academy-home.css` design tokens and `.academy-container`.

**New Backend Domain Service:**
- Add domain business logic in `src/server/services/[service-name].ts`.
- Expose mutation API routes under `src/app/api/[domain]/`.
- Write unit tests in `tests/unit/[service-name].test.ts`.

**New Database Table / Relation:**
- Define table in `src/server/db/schema.ts`.
- Run `npm run db:generate` followed by `npm run db:migrate`.

---

*Structure analysis: 2026-10-09*
