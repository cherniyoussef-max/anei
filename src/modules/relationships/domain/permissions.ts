// Phase 2 authorization vocabulary: organization roles and cross-user
// relationship/assignment types. Distinct from both the platform security
// role (`user.role`) and product-facing personas
// (src/modules/personas/domain/permissions.ts) — see docs/premium/
// SECURITY_MODEL.md §1: PERSONA grants portal access, ORGANIZATION
// MEMBERSHIP grants org-scoped capability, RELATIONSHIP/ASSIGNMENT grants
// cross-user access to one specific student. All three are DB-authoritative
// and checked independently; a persona alone never implies the others.

export const organizationRoles = ["OWNER", "MANAGER", "STAFF", "VIEWER"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

const roleRank: Record<OrganizationRole, number> = { VIEWER: 0, STAFF: 1, MANAGER: 2, OWNER: 3 };

/** True if `role` meets or exceeds `minRole` in the OWNER > MANAGER > STAFF > VIEWER hierarchy. */
export function organizationRoleAtLeast(role: OrganizationRole, minRole: OrganizationRole): boolean {
  return roleRank[role] >= roleRank[minRole];
}

export const parentRelationshipTypes = ["MOTHER", "FATHER", "GUARDIAN", "OTHER"] as const;
export type ParentRelationshipType = (typeof parentRelationshipTypes)[number];

export const parentLinkStatuses = ["PENDING", "ACTIVE", "REVOKED"] as const;
export type ParentLinkStatus = (typeof parentLinkStatuses)[number];

export const assignmentStatuses = ["ACTIVE", "ENDED"] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];
