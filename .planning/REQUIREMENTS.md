# Requirements: Académie Nationale de l'Éducation Inclusive (ANEI)

**Defined:** 2026-10-09
**Core Value:** Empower educators, school assistants (AVS), families, and specialists to transition theoretical inclusive education knowledge into structured, verifiable, and certified practice for neurodivergent and special-needs students.

## v1 Requirements

Requirements for current active iteration. Each maps to roadmap phases.

### Formation Quizzes & Assessments

- [ ] **QUIZ-01**: Mandatory interactive quiz component rendered upon completing each formation module.
- [ ] **QUIZ-02**: Simple, distraction-free multiple-choice question format with immediate scoring upon submission.
- [ ] **QUIZ-03**: Automated notification sent to administrator upon quiz completion containing learner identity, score, and passed status.
- [ ] **QUIZ-04**: Course progression gate ensuring module completion is locked until passing quiz threshold is achieved.

### UI Consistency & Design System Parity

- [ ] **UI-01**: Apply unified color palette, serif heading typography, and pill button styles across `/formations` and `/bibliotheque`.
- [ ] **UI-02**: Apply unified design tokens across `/avs` directory and `/webinaires` pages in both French and Arabic.
- [ ] **UI-03**: Apply unified design tokens across `/actualites` and `/contact` pages preserving existing form workflows and strict RTL mirror.
- [ ] **UI-04**: Guarantee homepage (`src/app/[locale]/(site)/page.tsx`) remains frozen and 100% pixel-identical before and after changes.

### Operational Readiness & Production Verification

- [ ] **OPS-01**: Comprehensive verification of end-to-end payment flows for Flouci and ClicToPay in staging and production modes.
- [ ] **OPS-02**: Validate private S3 storage signed URL authorization and upload pipelines under strict security headers.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### AI Pedagogical Assistant

- **AI-01**: Context-aware RAG pedagogical assistant behind ADR 0004 adapter boundary.
- **AI-02**: Automated transcript summarization and quiz generation from lesson videos.

### Mobile Application

- **MOB-01**: Native mobile client for offline video playback and offline quiz evaluation.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Microservice Migration | Unnecessary operational complexity; monolith satisfies latency and scaling goals (ADR 0001) |
| Public Static Media URLs | Security risk; educational content must remain behind presigned URLs (ADR 0002) |
| Unmoderated Reviews / Ratings | Incompatible with academic and institutional brand guidelines |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| QUIZ-01 | Phase 1 | Pending |
| QUIZ-02 | Phase 1 | Pending |
| QUIZ-03 | Phase 1 | Pending |
| QUIZ-04 | Phase 1 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 2 | Pending |
| UI-04 | Phase 2 | Pending |
| OPS-01 | Phase 3 | Pending |
| OPS-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-09*
*Last updated: 2026-10-09 after GSD project onboarding pass*
