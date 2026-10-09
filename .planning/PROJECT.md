# Académie Nationale de l'Éducation Inclusive (ANEI)

## What This Is

ANEI (الأكاديمية الوطنية للتربية الدامجة) is a bilingual French/Arabic web platform for professional training, pedagogical guidance, and clinical coordination in inclusive education across Tunisia and the MENA region. It integrates a public institutional website and AVS matching directory, a focused learner LMS, and an administrative console within a unified modular monolith.

## Core Value

Empower educators, school assistants (AVS), families, and specialists to transition theoretical inclusive education knowledge into structured, verifiable, and certified practice for neurodivergent and special-needs students.

## Business Context

- **Customer**: Educators, school life assistants (AVS), therapists/specialists, school administrations, and parents of special-needs children.
- **Revenue model**: Paid professional courses, webinar registrations, verifiable digital certificates, and institutional B2B subscriptions.
- **Success metric**: Course completion rate, certified AVS placements, and reliable bilingual learning delivery without operational regressions.
- **Strategy notes**: Follows `docs/architecture/ANEI_V4_ARCHITECTURE.md` and `docs/premium/ROADMAP.md`.

## Requirements

### Validated

- ✓ Modular monolith Next.js 16 App Router foundation with Drizzle ORM, PostgreSQL, and Redis caching. — v3.0
- ✓ Private S3-compatible media access with short-lived presigned URLs and admin direct uploads. — v3.1 (ADR 0002)
- ✓ Security hardening with per-request CSP nonce via `src/proxy.ts`, strict origin checks, and fail-closed RBAC. — v3.2 (ADR 0003)
- ✓ Bilingual French and Arabic visual architecture with first-class RTL layout and typographic parity. — v3.3
- ✓ Learner LMS course playback, module progression, and automated certificate generation. — v3.3
- ✓ Comprehensive admin console with 36 granular permissions, order tracking, and audit logging. — v3.3

### Active

- [ ] **QUIZ-01**: Mandatory simple quiz checkpoint after each formation module before completion.
- [ ] **QUIZ-02**: Automatic learner score calculation and instant result dispatch to platform administrator.
- [ ] **UI-01**: Unified visual design system and typographic hierarchy across all non-home secondary pages (/formations, /bibliotheque, /avs, /webinaires, /actualites, /contact) matching home tokens.
- [ ] **OPS-01**: Production integration verification for payment gateways (Flouci / ClicToPay) and external storage/messaging credentials.

### Out of Scope

- Microservices decomposition — rejected per ADR 0001 (unnecessary operational overhead for current scale).
- Client-side unauthenticated media hosting — rejected per ADR 0002 (paid media requires signed URLs).
- Untrusted third-party AI execution in core LMS paths — rejected per ADR 0004 (strict adapter boundaries required).
- Unmoderated public reviews or fabricated testimonials — prohibited by institutional brand guidelines.

## Context

- **Tech Stack**: Next.js 16.3.6 (App Router), React 19.2.8, TypeScript 5.9, Tailwind CSS v4, Drizzle ORM 0.45, PostgreSQL 16, Redis 7, Better Auth 1.5.
- **Key Constraints**: Homepage (`src/app/[locale]/(site)/page.tsx`) is frozen and must remain pixel-identical; bilingual parity (FR/AR) must be preserved; backend business logic and database migrations remain strictly guarded.

## Constraints

- **Architecture**: Modular monolith with domain service boundaries under `src/modules/` and `src/server/` (ADR 0001).
- **Security**: Per-request CSP nonce via `src/proxy.ts` and fail-closed RBAC (ADR 0003).
- **Storage**: Media assets strictly accessed via presigned S3 URLs (ADR 0002).
- **Design System**: Strict adherence to `design-system/anei/MASTER.md` and WCAG 2.2 AA accessibility standards.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js Modular Monolith | Low operational complexity, transactional integrity for LMS & payments | ✓ Good (ADR 0001) |
| Private Object Storage | Prevent unauthorized access to paid educational videos and documents | ✓ Good (ADR 0002) |
| Per-Request CSP Nonce | Strong browser-level XSS mitigation via proxy middleware | ✓ Good (ADR 0003) |
| AI & Job Queue Adapter Boundaries | Decouple core domain logic from specific LLM or worker implementations | ✓ Good (ADR 0004) |
| Bilingual Typography & RTL | Equal institutional stature for French and Arabic learners | ✓ Good |

---
*Last updated: 2026-10-09 after GSD project onboarding pass*
