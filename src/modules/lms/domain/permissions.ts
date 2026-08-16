// Phase 7 authorization vocabulary: cohort lifecycle, enrollment sources, and
// the organization-role gates that govern cohort/enrollment mutation.
// Follows the same shape as the Phase 4 admission module
// (src/modules/admission/domain/permissions.ts): reuses the Phase 2 role
// hierarchy instead of inventing a parallel one. The HTTP surface stays
// admin-only; these gates keep the domain service layer organization-ready
// and default-deny. See docs/premium/ROADMAP.md Phase 7.

import { organizationRoleAtLeast, type OrganizationRole } from "@/modules/relationships/domain/permissions";

export const cohortStatuses = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
export type CohortStatus = (typeof cohortStatuses)[number];

export const enrollmentSources = ["PAYMENT", "TEST_PASS", "ORGANIZATION", "ADMIN", "MANUAL"] as const;
export type EnrollmentSource = (typeof enrollmentSources)[number];

/** MANAGER and above: create/update cohorts and enroll students within their organization. */
export function canManageCohorts(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "MANAGER");
}

/** MANAGER and above: assign/unassign teachers to courses within their organization. */
export function canManageTeacherAssignments(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "MANAGER");
}
