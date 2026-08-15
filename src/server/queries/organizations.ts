import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { organization, organizationMembership, type OrganizationMembershipRow, type OrganizationRow } from "@/server/db/schema";
import { organizationRoleAtLeast, type OrganizationRole } from "@/modules/relationships/domain/permissions";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Returns the caller's own ACTIVE membership row for `organizationId`, or
 * null. This is the sole authorization primitive for org-scoped routes: the
 * `organizationId` from a URL/body is only ever a target to check against a
 * row owned by `userId`, never trusted as authorization by itself (see
 * docs/premium/SECURITY_MODEL.md §2).
 */
export async function getOwnOrganizationMembership(
  userId: string,
  organizationId: string,
): Promise<OrganizationMembershipRow | undefined> {
  const [row] = await db
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.organizationId, organizationId),
        eq(organizationMembership.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return row;
}

/** True if the caller holds an ACTIVE membership of at least `minRole` in `organizationId`. */
export async function requireOrgMembership(
  userId: string,
  organizationId: string,
  minRole: OrganizationRole = "VIEWER",
): Promise<OrganizationMembershipRow | null> {
  const membership = await getOwnOrganizationMembership(userId, organizationId);
  if (!membership) return null;
  return organizationRoleAtLeast(membership.role as OrganizationRole, minRole) ? membership : null;
}

/** The caller's own organization memberships (drives the organization portal). */
export async function getUserOrganizationMemberships(userId: string) {
  return db
    .select({ membership: organizationMembership, organization })
    .from(organizationMembership)
    .innerJoin(organization, eq(organization.id, organizationMembership.organizationId))
    .where(and(eq(organizationMembership.userId, userId), eq(organizationMembership.status, "ACTIVE")));
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMembershipRow[]> {
  return db.select().from(organizationMembership).where(eq(organizationMembership.organizationId, organizationId));
}

export async function listOrganizations(): Promise<OrganizationRow[]> {
  return db.select().from(organization);
}

export async function countActiveOwners(client: DbClient, organizationId: string, excludeMembershipId?: string) {
  const rows = await client
    .select({ id: organizationMembership.id })
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.organizationId, organizationId),
        eq(organizationMembership.role, "OWNER"),
        eq(organizationMembership.status, "ACTIVE"),
      ),
    );
  return rows.filter((row) => row.id !== excludeMembershipId).length;
}
