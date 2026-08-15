---
name: feature-delivery
description: "Structured workflow for implementing a feature or change in the ANEI Platform repository (Next.js/TypeScript/Drizzle/Better Auth/Redis LMS). Trigger when the user asks to implement, add, fix, or change a feature in this codebase and wants a disciplined discover-plan-implement-verify-review cycle rather than an ad-hoc edit. Use when the task is non-trivial: touches more than one file, crosses a security boundary (auth, payments, storage, admin), touches the database, or needs test/verification coverage. Not needed for a one-line typo fix or a pure question."
---

# /feature-delivery

Delivers a single ANEI Platform feature or change through a bounded, disciplined
workflow: DISCOVER → PLAN → PLAN CRITIQUE → IMPLEMENT → TARGETED VERIFY →
REVIEW → REPAIR (bounded) → FINAL VERIFY.

This skill governs *process*, not a fixed architecture. Current source code
and tests are always authoritative. `docs/AI_PROJECT_DOSSIER.md` is a useful
architectural map to orient quickly, but it is a point-in-time snapshot —
**never assume it is newer or more correct than the source it describes.**
If the dossier and the source disagree, trust the source and treat the
dossier line as stale.

## When to use this skill

Use it when implementing or changing a feature in this repository. Skip the
ceremony for trivial, single-file, obviously-scoped edits — go straight to
IMPLEMENT → TARGETED VERIFY for those, per the DISCOVER section below.

## 1. DISCOVER

For unfamiliar or cross-module work:

- Use Graphify first (`graphify query "<focused question>" --budget 800`
  against `graphify-out/graph.json`). Make focused queries using repository
  symbols/concepts, not broad natural-language questions.
- Use `docs/AI_PROJECT_DOSSIER.md` to jump to the right area quickly (its
  "Critical Files Index" and "Extension Patterns" sections are good starting
  points), then verify anything you rely on against current source — the
  dossier is a reference, not a source of truth.
- Locate the closest existing implementation pattern in the repo before
  inventing a new one.
- Inspect only the files necessary to verify the pattern and plan the change
  — do not read the whole codebase speculatively.

For trivial/local work where the required implementation is already obvious
(e.g. a small, self-contained fix in a file you've already identified), do
not force unnecessary architecture exploration — skip straight to IMPLEMENT.

Before editing, identify:

- an existing pattern to reuse (query/service/route/component shape)
- the files likely affected
- security boundaries touched (auth, authorization, origin/CSRF, rate
  limiting, storage entitlement checks, payment verification)
- database impact (schema, migration, constraints, transactions,
  idempotency)
- API impact (new/changed route contracts)
- frontend impact (locale/FR-AR, RTL, client/server boundary)
- tests/checks likely required

## 2. SUBAGENT DECISION

Do not automatically spawn subagents. Choose the smallest number that covers
genuinely independent investigation:

- **0 subagents**: small/local task, one domain, obvious implementation.
- **1 subagent**: one independent uncertainty deserving separate
  investigation.
- **2 subagents**: two genuinely independent domains, e.g. backend +
  frontend.
- **3 subagents (normal maximum)**: a substantial cross-domain feature,
  e.g. database + backend/security + frontend/testing.
- **4 subagents**: only for unusually broad architecture/research work.

Never assign multiple agents to perform substantially the same repository
exploration. Subagents should primarily research/review independent
concerns; the main agent owns final architecture, integration, and
implementation. Prefer foreground work and use subagents mainly to gather
results that feed back into a single implementation plan. Use background
agents only when the work is truly independent and long-running.

Do not create speculative abstractions to make the work "cleaner" for
imagined future subagent parallelism.

## 3. PLAN

Before touching non-trivial code (schema/migration, auth/permission, API,
or UI work), write a short plan covering:

- the smallest change that satisfies the request
- files to be added/modified
- the existing pattern being followed (name it explicitly)
- any new abstraction being introduced, and why it's justified

Do not plan speculative abstractions or generalize beyond what the request
needs.

## 4. PLAN CRITIQUE

Before implementing a significant feature, challenge the plan:

- Is there an existing ANEI pattern that should be reused instead?
- Is any proposed abstraction unnecessary?
- Can the change be smaller?
- Could this weaken authentication or authorization?
- Does it preserve origin/CSRF behavior where applicable?
- Does it preserve rate limiting?
- Does it preserve bounded input + Zod validation?
- For payments: does server-to-server verification remain authoritative
  (never trust client redirect or webhook payload for status)?
- For storage: is entitlement checked before signing a URL?
- For DB writes: are transaction/idempotency requirements preserved?
- Are monetary values kept as integer millimes?
- Does FR/AR (locale, RTL) need explicit handling?

Revise the plan if the critique surfaces a concrete problem. Don't revise
for style preferences alone.

## 5. IMPLEMENT

Implement the smallest production-safe solution. Priority order:

1. existing repository pattern
2. existing helper/component/service
3. platform/stdlib capability
4. already-installed dependency
5. new abstraction/dependency — only with concrete justification

Preserve Ponytail's simplicity discipline: no unrequested abstractions, no
speculative scaffolding, shortest correct diff.

Do not weaken: authentication, authorization, validation, security checks,
DB constraints, transactions, idempotency, audit requirements, or
entitlement checks. These are non-negotiable even when they add lines to an
otherwise small diff.

## 6. TARGETED VERIFICATION

Verify with the cheapest, most focused check first, broadening only as
needed:

1. targeted test(s) for the changed behavior
2. changed-area typechecking/lint where possible (e.g. a single file/module)
3. `npm run typecheck`
4. `npm run lint`
5. relevant unit/security/integration/E2E tests
6. `npm run build` when production compilation or runtime integration may
   be affected

Use `npm run check` (the full local gate) for: substantial changes,
cross-cutting changes, authentication/security changes, payment changes,
DB/schema/migration changes, or merge-ready verification. Do not run
expensive suites repeatedly without reason.

## 7. REVIEW

Inspect `git diff`. Review for:

**Correctness**: requested behavior implemented; error paths handled; race
conditions considered; edge cases covered.

**Architecture**: existing patterns reused; no unnecessary abstractions; no
duplicated or bypassed auth/authz, origin/CSRF validation, rate limiting,
or entitlement checks; cache invalidation/staleness considered if caching
is touched; FR/AR and RTL handled if user-facing copy/layout changed; no
speculative loading/error-state complexity that adds no real value.

Classify every finding as **BLOCKER**, **SHOULD_FIX**, or **OPTIONAL**.

## 8. BOUNDED REPAIR LOOP

Repair BLOCKER and justified SHOULD_FIX findings. After each repair:

- rerun only the affected verification first (not the full suite)
- inspect the affected diff again

Maximum 3 repair iterations. Stop early when:

- no BLOCKER remains
- no justified SHOULD_FIX remains
- required checks pass

Do not repeatedly rewrite working code merely to obtain a different style.

## 9. FINAL VERIFICATION

Before declaring the task complete:

- inspect `git diff`
- inspect `git status`
- verify no accidental/unrelated files were changed
- confirm which checks were run and their pass/fail results
- identify any checks that were not run, and why
- identify residual risks

Do not commit unless explicitly requested by the user.

## FINAL RESPONSE

Return a concise report with exactly these sections:

1. What changed
2. Files changed
3. Existing patterns reused
4. Important architectural decisions
5. Security/data considerations
6. Tests/checks run — pass/fail status
7. Review/repair iterations performed
8. Remaining risks or manual verification needed
9. Anything intentionally not done

Keep it concise — this is a report, not a narrative.
