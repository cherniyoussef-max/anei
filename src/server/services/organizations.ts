import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, organization, organizationMembership, type OrganizationRow } from "@/server/db/schema";
import { countActiveOwners } from "@/server/queries/organizations";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";

type MutationResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "last_owner" };

/**
 * Creates an organization with its founding OWNER membership in one
 * transaction — an organization is never created without at least one
 * active owner.
 */
export async function createOrganization(
  actorUserId: string,
  data: { name: string; slug: string },
  ownerUserId: string,
): Promise<OrganizationRow> {
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organization).values(data).returning();
    await tx.insert(organizationMembership).values({
      organizationId: org.id,
      userId: ownerUserId,
      role: "OWNER",
      status: "ACTIVE",
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "organization.create",
      entityType: "organization",
      entityId: org.id,
      metadata: { name: data.name, slug: data.slug, ownerUserId },
    });
    return org;
  });
}

export async function addOrganizationMember(
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
  role: OrganizationRole,
): Promise<MutationResult & { membershipId?: string }> {
  return db.transaction(async (tx) => {
    // Serializes all ownership-relevant mutations for this organization —
    // see changeOrganizationMemberRole for why this lock is required.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationId}))`);

    const [org] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, organizationId)).limit(1);
    if (!org) return { kind: "not_found" };

    const [existing] = await tx
      .select({ id: organizationMembership.id })
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.organizationId, organizationId),
          eq(organizationMembership.userId, targetUserId),
          eq(organizationMembership.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (existing) return { kind: "ok", membershipId: existing.id };

    const [membership] = await tx
      .insert(organizationMembership)
      .values({ organizationId, userId: targetUserId, role, status: "ACTIVE" })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "organizationMembership.create",
      entityType: "organization_membership",
      entityId: membership.id,
      metadata: { organizationId, targetUserId, role },
    });
    return { kind: "ok", membershipId: membership.id };
  });
}

/**
 * Concurrency-safe last-active-OWNER protection: a pg_advisory_xact_lock
 * keyed on organizationId (same primitive as adminSetPrimaryPersona's
 * per-user lock) serializes every ownership-mutating transaction for this
 * organization, so two concurrent requests can never both read "2 owners"
 * and both proceed to demote one — the second waits for the first's
 * transaction to commit (or roll back) before its own count is taken. This
 * closes the "SELECT count then UPDATE" race a naive check would leave open.
 */
export async function changeOrganizationMemberRole(
  actorUserId: string,
  organizationId: string,
  membershipId: string,
  newRole: OrganizationRole,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationId}))`);

    const [membership] = await tx
      .select()
      .from(organizationMembership)
      .where(and(eq(organizationMembership.id, membershipId), eq(organizationMembership.organizationId, organizationId)))
      .limit(1);
    if (!membership || membership.status !== "ACTIVE") return { kind: "not_found" };

    if (membership.role === "OWNER" && newRole !== "OWNER") {
      const remainingOwners = await countActiveOwners(tx, organizationId, membershipId);
      if (remainingOwners < 1) return { kind: "last_owner" };
    }

    await tx.update(organizationMembership).set({ role: newRole, updatedAt: new Date() }).where(eq(organizationMembership.id, membershipId));
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "organizationMembership.role.change",
      entityType: "organization_membership",
      entityId: membershipId,
      metadata: { organizationId, from: membership.role, to: newRole },
    });
    return { kind: "ok" };
  });
}

/** Revokes a membership. Same last-owner protection as role changes. */
export async function revokeOrganizationMembership(
  actorUserId: string,
  organizationId: string,
  membershipId: string,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationId}))`);

    const [membership] = await tx
      .select()
      .from(organizationMembership)
      .where(and(eq(organizationMembership.id, membershipId), eq(organizationMembership.organizationId, organizationId)))
      .limit(1);
    if (!membership || membership.status !== "ACTIVE") return { kind: "not_found" };

    if (membership.role === "OWNER") {
      const remainingOwners = await countActiveOwners(tx, organizationId, membershipId);
      if (remainingOwners < 1) return { kind: "last_owner" };
    }

    await tx.update(organizationMembership).set({ status: "REVOKED", updatedAt: new Date() }).where(eq(organizationMembership.id, membershipId));
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "organizationMembership.remove",
      entityType: "organization_membership",
      entityId: membershipId,
      metadata: { organizationId, role: membership.role },
    });
    return { kind: "ok" };
  });
}
