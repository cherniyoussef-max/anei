import { and, count, eq, ilike, or } from "drizzle-orm";
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

/** Unbounded-looking but capped listing — the only caller (GET /api/admin/organizations) has no pagination UI/consumer today; the cap is a safety bound, not a real limit for expected data volume. Use listOrganizationsPage for anything that needs real pagination. */
export async function listOrganizations(): Promise<OrganizationRow[]> {
  return db.select().from(organization).orderBy(organization.name).limit(500);
}

/** Single-row lookup by primary key, for pages that only need to validate/render one organization. */
export async function getOrganizationById(organizationId: string): Promise<OrganizationRow | undefined> {
  const [row] = await db.select().from(organization).where(eq(organization.id, organizationId)).limit(1);
  return row;
}

const ORG_PAGE_SIZE = 25;

/** Paginated, optionally search-filtered organization listing for admin list pages. */
export async function listOrganizationsPage(input: { q?: string; page?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const where = input.q ? or(ilike(organization.name, `%${input.q}%`), ilike(organization.slug, `%${input.q}%`)) : undefined;
  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(organization).where(where).orderBy(organization.name).limit(ORG_PAGE_SIZE).offset((page - 1) * ORG_PAGE_SIZE),
    db.select({ value: count() }).from(organization).where(where),
  ]);
  return { items, total, page, pageSize: ORG_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / ORG_PAGE_SIZE)) };
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
