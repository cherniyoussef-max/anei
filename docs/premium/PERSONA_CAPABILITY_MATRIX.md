# Persona Capability Matrix (Phase 0 — planning only)

This matrix governs **persona-scoped** capability, layered on top of — never in place
of — Better Auth's `user.role` (`USER`/`ADMIN`/`SUPER_ADMIN`) and the existing admin
permission set in `src/modules/admin/domain/permissions.ts`. A row here answers "what
can this persona do in its own portal," not "is this user a platform administrator."
`ADMIN`/`SUPER_ADMIN` retain full existing cross-cutting access via the current admin
routes/permissions regardless of persona.

## Personas

| Persona | Definition |
|---|---|
| `STUDENT` | Learner consuming courses/resources (today's default, `profileType: learner`) |
| `TEACHER` | Assigned to courses via `relationship: TEACHER_OF_COURSE`; teaches cohorts |
| `AVS` | Accompanying support professional; directory listing + assigned students |
| `PARENT` | Linked to one or more students via `relationship: PARENT_OF_STUDENT` |
| `SPECIALIST` | Linked to one or more students via `relationship: SPECIALIST_OF_STUDENT` |
| `ORGANIZATION` | Acts through `organization_membership`, not a personal persona capability set — see §Organization roles |

A user may hold multiple personas simultaneously (e.g., `TEACHER` + `PARENT`); each
portal only exposes that persona's own capabilities, scoped to that user's identity.

## Capability matrix

| Capability | STUDENT | TEACHER | AVS | PARENT | SPECIALIST | Data scope |
|---|---|---|---|---|---|---|
| View own enrollments/progress/certificates | ✅ | — | — | — | — | self (`enrollments.userId = self`) |
| Purchase courses/resources | ✅ | — | — | — | — | self |
| View assigned course's cohort roster | — | ✅ | — | — | — | cohorts where `relationship.subject=self, type=TEACHER_OF_COURSE` |
| Mark lesson/cohort attendance | — | ✅ | — | — | — | own cohort only |
| View own AVS directory profile / edit availability | — | — | ✅ | — | — | own `avsProfiles` row (admin still moderates `certified`/`visible`) |
| View assigned student's progress/attendance summary | — | — | ✅ | — | — | students where `relationship.object=student, subject=self, status=ACTIVE` |
| View linked student's progress/certificates | — | — | — | ✅ | — | students where `relationship.type=PARENT_OF_STUDENT, subject=self, status=ACTIVE` |
| View linked student's assessment/specialist notes | — | — | — | — | ✅ | students where `relationship.type=SPECIALIST_OF_STUDENT, subject=self, status=ACTIVE` |
| Message a linked student/guardian (in-app/WhatsApp thread) | — | ✅ (cohort) | ✅ (assigned) | ✅ (own child) | ✅ (assigned) | scoped to an existing `relationship`/`cohort_membership` row |
| Never: view unrelated student's data | ✅ enforced | ✅ enforced | ✅ enforced | ✅ enforced | ✅ enforced | denied unless an ACTIVE relationship/cohort membership row exists |
| Never: self-grant a relationship to a student | ✅ enforced | n/a | ✅ enforced | ✅ enforced | ✅ enforced | relationship rows are admin/organization-manager created only |

Every "own"/"assigned"/"linked" scope above is enforced the same way
`getPurchasedResourceForDownload(session.user.id, resourceId)` scopes resource
downloads today: the caller's session `user.id` drives the query's WHERE clause; no
route accepts a client-supplied `userId`/`studentId` as the authorization input, only
as a target to be checked against a relationship/membership row owned by the caller.

## Organization roles (distinct axis — `organization_membership.role`)

| Capability | OWNER | MANAGER | STAFF | VIEWER |
|---|---|---|---|---|
| Manage organization membership (invite/remove) | ✅ | ✅ | — | — |
| Manage organization billing/plan | ✅ | — | — | — |
| Create/manage cohorts under the organization | ✅ | ✅ | ✅ | — |
| Create/manage CRM contacts/conversations under the organization | ✅ | ✅ | ✅ | — |
| Bulk-enroll students (`enrollments.source=ORGANIZATION`) | ✅ | ✅ | — | — |
| View organization-scoped analytics/reports | ✅ | ✅ | ✅ | ✅ |
| Access another organization's data | denied for all roles — `organization_id` is always derived from the caller's own `organization_membership` row |

## Portal → capability mapping

| Portal route group | Personas allowed in | Guard |
|---|---|---|
| `/[locale]/portal/student` (existing `dashboard`, reused) | STUDENT | `requireUser()` (existing) |
| `/[locale]/portal/teacher` | TEACHER | `requirePersona(session, "TEACHER")` |
| `/[locale]/portal/avs` | AVS | `requirePersona(session, "AVS")` |
| `/[locale]/portal/parent` | PARENT | `requirePersona(session, "PARENT")` |
| `/[locale]/portal/specialist` | SPECIALIST | `requirePersona(session, "SPECIALIST")` |
| `/[locale]/portal/organization/[orgId]` | any `organization_membership` role | `requireOrgMembership(session, orgId)` |
| `/[locale]/admin/*` (existing, unchanged) | `user.role in (ADMIN, SUPER_ADMIN)` | `getAdminSession()`/`getAdminSessionFor(permission)` (existing, unchanged) |

`requirePersona()`/`requireOrgMembership()` are new helpers in
`src/modules/personas/domain/permissions.ts`, structured identically to
`hasAdminPermission()` — a pure function over role/persona/membership plus a thin
session-fetching wrapper (`getAdminSession()`'s shape), not a new authorization
paradigm.
