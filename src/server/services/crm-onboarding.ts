import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { crmContact, crmContactActivity, organization } from "@/server/db/schema";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * ANEI's own platform organization — the CRM owner for every learner who
 * self-registers on the site (as opposed to a partner organization's own
 * contacts). `crm_contact.organizationId` is NOT NULL (docs/premium/
 * ROADMAP.md's original "organizationId IS NULL for ANEI-direct contacts"
 * plan was superseded during Phase 3 implementation — the schema is
 * authoritative, see CLAUDE.md), so every self-registered learner needs a
 * real owning organization row. Identified by a fixed slug rather than an
 * env-configured id so it never needs a manual seeding step in any
 * environment (dev/staging/prod all lazily converge on the same row).
 */
const ANEI_PLATFORM_ORG_SLUG = "anei-platform";

export async function ensureAneiPlatformOrganization(tx: DbClient = db): Promise<string> {
  const [existing] = await tx
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ANEI_PLATFORM_ORG_SLUG))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(organization)
    .values({ name: "ANEI Platform", slug: ANEI_PLATFORM_ORG_SLUG, status: "ACTIVE" })
    .onConflictDoNothing({ target: organization.slug })
    .returning({ id: organization.id });
  if (created) return created.id;

  // Lost a race against a concurrent first-caller — the row now exists.
  const [row] = await tx
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ANEI_PLATFORM_ORG_SLUG))
    .limit(1);
  if (!row) throw new Error("ANEI_PLATFORM_ORG_BOOTSTRAP_FAILED");
  return row.id;
}

/**
 * Idempotently provisions (creates or refreshes) the CRM contact row for a
 * self-registered learner, linked via `linkedUserId`. Called from inside
 * `completeUserProfile`'s transaction (src/server/auth/profile.ts) once a
 * phone number is known, so the profile write and the CRM contact commit or
 * roll back together. `actorUserId` is the learner themselves — a CRM
 * contact created from self-registration is not a staff action, and the
 * audit/activity trail records that honestly (never impersonates an admin
 * actor). Never throws on a data-shape it doesn't expect from the caller;
 * the caller has already validated firstName/lastName/phone via
 * `profileSchema`.
 */
export async function provisionCrmContactForUser(
  tx: DbClient,
  userId: string,
  data: { firstName: string; lastName: string; email?: string | null; phone?: string | null },
): Promise<{ contactId: string; organizationId: string }> {
  const organizationId = await ensureAneiPlatformOrganization(tx);

  const [existing] = await tx
    .select({ id: crmContact.id })
    .from(crmContact)
    .where(and(eq(crmContact.organizationId, organizationId), eq(crmContact.linkedUserId, userId)))
    .limit(1);

  if (existing) {
    await tx
      .update(crmContact)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        updatedAt: new Date(),
      })
      .where(eq(crmContact.id, existing.id));
    return { contactId: existing.id, organizationId };
  }

  let created: { id: string } | undefined;
  try {
    [created] = await tx
      .insert(crmContact)
      .values({
        organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        linkedUserId: userId,
        createdByUserId: userId,
      })
      .returning({ id: crmContact.id });
  } catch {
    // Lost a race against a concurrent provisioning call for this user — the
    // row now exists; fall through to the update path below.
    const [row] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.organizationId, organizationId), eq(crmContact.linkedUserId, userId)))
      .limit(1);
    if (!row) throw new Error("CRM_CONTACT_PROVISIONING_RACE_UNRESOLVED");
    await tx
      .update(crmContact)
      .set({ firstName: data.firstName, lastName: data.lastName, email: data.email ?? null, phone: data.phone ?? null, updatedAt: new Date() })
      .where(eq(crmContact.id, row.id));
    return { contactId: row.id, organizationId };
  }

  await tx.insert(crmContactActivity).values({
    contactId: created.id,
    actorUserId: userId,
    type: "CONTACT_AUTO_PROVISIONED",
    metadata: { source: "self_registration" },
  });

  return { contactId: created.id, organizationId };
}
