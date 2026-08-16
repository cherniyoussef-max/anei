# Phase 7 Handoff — LMS Enrollments, Cohorts & Teacher-Course Assignments

## Scope implemented

- `enrollments.source` (additive column): `PAYMENT` (default) / `TEST_PASS` / `ORGANIZATION` / `ADMIN` / `MANUAL`.
- `cohort` + `cohortMembership`: organization-scoped cohorts, membership references an `enrollments` row (no second student/course truth).
- `teacherCourseAssignment`: teacher↔course grant, same shape as `avsStudentAssignment`.
- Admin/org-manager APIs: `admin/cohorts`, `admin/cohorts/[id]` (status), `admin/relationships/teacher-assignments(+[id])`, `admission/enroll` (the funnel terminal step).
- Minimal admin UI: enroll form on the admission detail page (only shown once ACCEPTED + linked user), cohort list/roster pages under `admin/crm/[orgId]/cohorts`, teacher-assignment form on `admin/relationships`.
- `getAssignedCoursesForTeacher`/`isTeacherAssignedToCourse` queries exist for Phase 11's `/teacher/cohortes` wiring — that page itself is explicitly out of scope this phase (per `ROADMAP.md`).

## Architecture decisions

- **Followed this repo's own `ROADMAP.md`/`DATA_MODEL.md` Phase 7 spec**, not the generic brief's invented `course_enrollment`/state-machine model — the existing `enrollments` table (from Phase 0) is already the authoritative entitlement table used by `hasEntitlement`/`getLearningCourse`; inventing a parallel table would have created two sources of truth and broken `docs/premium/ARCHITECTURE.md`'s additive-migration guarantee.
- **`enrollments.status` (active/completed/cancelled) is unchanged** — no SUSPENDED state added. The generic brief's suspend/reactivate lifecycle is not part of this repo's Phase 7 plan; flagging as intentionally deferred, not an oversight.
- **`enrollStudent`** is the single explicit enrollment-creation path outside the existing payment flow (`checkout.ts`'s `grantPaidOrderTx`, untouched). It is idempotent via the pre-existing `enrollment_user_course_unique` index + `onConflictDoNothing`, so concurrent duplicate calls converge on one row (test-proven).
- **Cohort capacity** is enforced transactionally under a per-cohort `pg_advisory_xact_lock` (same primitive as `organizations.ts`'s last-owner lock), not a client-side count.
- **`enrollContact`** is the admission→enrollment boundary: resolves `contactId → crmContact.linkedUserId` server-side (never trusts a client `userId`), requires `ACTIVE` contact + `ACCEPTED` admission + linked user, then calls `enrollStudent` with `source: "ORGANIZATION"`. ACCEPTED admission alone, or a consumed invitation alone, never enrolls (test-proven).
- **Teacher assignment** follows `avsStudentAssignment`/`specialistStudentAssignment` exactly: `ON DELETE restrict` (history preserved), partial-unique `ACTIVE` index, requires the target to hold an `ACTIVE TEACHER` persona. Grants a query-scoped teaching view only for the assigned course — no platform role or course-edit escalation.
- **CRM activity**: `COURSE_ENROLLED` added to the existing bounded `crm_contact_activity` type check, written in the same transaction as the enrollment when a `contactId` is present.

## Purchase compatibility

`checkout.ts`/`grantPaidOrderTx` is unmodified. `enrollments.source` defaults to `'PAYMENT'`, so every historical and future paid enrollment is unaffected. Regression-tested: `markMockOrderPaid` → `getLearningCourse` still grants access with `source = 'PAYMENT'`.

## LMS access rule

Unchanged: `getLearningCourse`/`hasEntitlement` check only for the presence of an `enrollments` row, never its `source`. Test-proven that a `TEST_PASS`-sourced row grants identical access to a `PAYMENT`-sourced one.

## Organization isolation

`enrollStudent`'s cohort branch requires the cohort to match both `courseId` and (when `organizationId` is passed) `organizationId` — cross-org cohort use returns `invalid_cohort` (test-proven IDOR). All cohort/teacher-assignment/enroll routes resolve the org role server-side via `resolveActorOrgRole`, never trust a client-asserted role.

## Migration

`drizzle/0011_lms_cohorts_teacher_assignments.sql`, hand-authored (drizzle-kit's `generate` had no `meta/` journal to diff against in this repo and would have emitted a full-schema baseline; discarded, matching the existing 0001–0010 convention of hand-written incremental SQL). Migrations 0000–0010 unchanged (`git diff --stat` empty). Applied and verified against the local dev DB.

## Key files

- `src/server/db/schema.ts` (enrollments.source, cohort, cohortMembership, teacherCourseAssignment)
- `src/modules/lms/domain/permissions.ts`
- `src/server/services/{cohorts,enrollments,teacher-assignments}.ts`
- `src/server/queries/{cohorts,teacher-assignments}.ts`
- `src/app/api/{admin/cohorts,admin/relationships/teacher-assignments,admission/enroll}/**`
- `tests/integration/lms-enrollments.test.ts`, `tests/unit/lms-permissions.test.ts`

## Tests / results

- `tests/integration/lms-enrollments.test.ts`: 11/11 pass — source-parity entitlement, idempotent + concurrent duplicate enrollment, cross-org cohort IDOR, cohort capacity concurrency, teacher persona requirement + IDOR, teacher-assignment history preservation, admission-alone-doesn't-enroll, full admission→link→enroll happy path, existing purchase-flow regression.
- `tests/unit/lms-permissions.test.ts`: 2/2 pass.
- Full suite: `test:unit` 149/149, `test:security` 3/3, `test:integration` 143/143 (includes all Phase 1–6 regression suites — CRM, admissions, WhatsApp, storage-authorization, organizations, relationships), all pass.
- `typecheck`: clean. `build`: clean, all new routes listed in output. `deps:check`, `security:audit`: pass.
- `lint`: exactly the 5 pre-existing `no-explicit-any` errors in `src/modules/admin/queries/admin-users.ts` — zero new errors.

## Known debt / deferred

- No enrollment SUSPENDED/reactivation lifecycle (not in this repo's Phase 7 plan — see decision above).
- `/teacher/cohortes` UI is a stub (pre-existing) still pointing nowhere; wiring it to `getAssignedCoursesForTeacher` is explicitly Phase 11.
- Admin forms use raw UUID text inputs for teacher/organization IDs on the platform-wide `admin/relationships` page, matching the existing `AdminParentLinkForm`/`AdminAvsAssignmentForm` convention (no course/org context available on that page); course/cohort selects are used wherever context is available (enroll form, cohort create form).

## Phase 8 boundary

No Cloudflare Stream, signed video tokens, or `lessons.mediaProvider`/`mediaRef` touched. Phase 7 only decided *whether* a user is entitled; Phase 8 owns *how* protected video is served.
