# Roadmap: Académie Nationale de l'Éducation Inclusive (ANEI)

## Overview

This roadmap defines the active development milestone for ANEI: delivering mandatory formation assessments with automated admin scoring notifications, aligning platform-wide design system consistency across secondary pages while maintaining strict homepage freeze constraints, and validating operational production readiness.

## Phases

- [ ] **Phase 1: Formation Assessment & Admin Quiz Dispatch** - Implement mandatory post-course quizzes with instant scoring and admin notifications.
- [ ] **Phase 2: Platform-Wide Design System Parity** - Unify visual hierarchy, typography, and RTL parity across all non-home pages.
- [ ] **Phase 3: Production Hardening & Integration Assurance** - Verify payment reconciliation, private S3 presigned URLs, and test suites.

## Phase Details

### Phase 1: Formation Assessment & Admin Quiz Dispatch
**Goal**: Implement mandatory, simple quiz checkpoints after every formation with automated score calculation and direct admin notification.
**Depends on**: Nothing (first phase)
**Requirements**: QUIZ-01, QUIZ-02, QUIZ-03, QUIZ-04
**Success Criteria** (what must be TRUE):
  1. Learner sees a clean, distraction-free quiz after completing a formation module.
  2. Learner receives immediate score calculation upon quiz submission.
  3. Administrator receives an automatic notification with learner details, score, and pass/fail status.
  4. Course progression enforces passing quiz threshold before marking formation completed.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Platform-Wide Design System Parity
**Goal**: Bring all non-home secondary pages (/formations, /bibliotheque, /avs, /webinaires, /actualites, /contact) to complete visual consistency with home design tokens in French and Arabic while keeping the homepage frozen.
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Headings across all secondary pages use signature serif typography and gold eyebrow accents.
  2. Buttons and interactive cards adopt consistent pill radii, subtle borders, and accessible hover states.
  3. French and Arabic layouts exhibit true bidirectional mirroring with authentic RTL alignment.
  4. Homepage (`src/app/[locale]/(site)/page.tsx`) remains 100% pixel-identical without regressions.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Production Hardening & Integration Assurance
**Goal**: Verify end-to-end payment gateway reconciliation, private object storage signed URL authorization, and system security posture.
**Depends on**: Phase 2
**Requirements**: OPS-01, OPS-02
**Success Criteria** (what must be TRUE):
  1. Payment checkouts via Flouci and ClicToPay execute reliably in sandbox and production configurations.
  2. Presigned S3 URLs authorize valid enrollments and block direct public unauthenticated requests.
  3. Automated Playwright E2E and unit test suites pass completely across all routes and locales.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Formation Assessment & Admin Quiz Dispatch | 0/1 | Not started | - |
| 2. Platform-Wide Design System Parity | 0/1 | Not started | - |
| 3. Production Hardening & Integration Assurance | 0/1 | Not started | - |
