import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  crmContact,
  crmContactActivity,
  crmContactNote,
  crmContactTag,
  crmPipeline,
  crmPipelineStage,
  crmTag,
  organizationMembership,
  type CrmContactRow,
} from "@/server/db/schema";
import type { CrmContactActivityType } from "@/modules/crm/domain/permissions";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type MutationResult =
  | { kind: "ok"; id: string }
  | { kind: "not_found" }
  | { kind: "invalid_assignee" }
  | { kind: "invalid_stage" }
  | { kind: "conflict" };

async function logActivity(
  tx: DbClient,
  contactId: string,
  actorUserId: string | null,
  type: CrmContactActivityType,
  metadata?: Record<string, unknown>,
) {
  await tx.insert(crmContactActivity).values({ contactId, actorUserId, type, metadata });
}

/** Active organization membership check — the sole authorization primitive for assignee/actor validity. */
async function isActiveOrgMember(tx: DbClient, organizationId: string, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: organizationMembership.id })
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.organizationId, organizationId),
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Creates a CRM contact and its CONTACT_CREATED activity row in one
 * transaction. `linkedUserId`/`assignedToUserId` are optional and, when
 * supplied, are validated against real ACTIVE organization membership rows
 * — never trusted merely because the client sent them
 * (docs/premium/ROADMAP.md Phase 3 §D/§E). A CRM contact never implies or
 * creates a user account.
 */
export async function createCrmContact(
  actorUserId: string,
  organizationId: string,
  data: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    linkedUserId?: string | null;
    assignedToUserId?: string | null;
    currentStageId?: string | null;
  },
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    if (data.assignedToUserId && !(await isActiveOrgMember(tx, organizationId, data.assignedToUserId))) {
      return { kind: "invalid_assignee" };
    }
    if (data.currentStageId) {
      const [stage] = await tx
        .select({ id: crmPipelineStage.id })
        .from(crmPipelineStage)
        .where(and(eq(crmPipelineStage.id, data.currentStageId), eq(crmPipelineStage.organizationId, organizationId)))
        .limit(1);
      if (!stage) return { kind: "invalid_stage" };
    }

    let contact: CrmContactRow;
    try {
      [contact] = await tx
        .insert(crmContact)
        .values({
          organizationId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email ?? null,
          phone: data.phone ?? null,
          linkedUserId: data.linkedUserId ?? null,
          assignedToUserId: data.assignedToUserId ?? null,
          currentStageId: data.currentStageId ?? null,
          createdByUserId: actorUserId,
        })
        .returning();
    } catch {
      return { kind: "conflict" };
    }

    await logActivity(tx, contact.id, actorUserId, "CONTACT_CREATED", {
      firstName: data.firstName,
      lastName: data.lastName,
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.contact.create",
      entityType: "crm_contact",
      entityId: contact.id,
      metadata: { organizationId },
    });
    return { kind: "ok", id: contact.id };
  });
}

export async function updateCrmContact(
  actorUserId: string,
  organizationId: string,
  contactId: string,
  data: { firstName?: string; lastName?: string; email?: string | null; phone?: string | null },
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };

    await tx.update(crmContact).set({ ...data, updatedAt: new Date() }).where(eq(crmContact.id, contactId));
    await logActivity(tx, contactId, actorUserId, "CONTACT_UPDATED", { fields: Object.keys(data) });
    return { kind: "ok", id: contactId };
  });
}

export async function archiveCrmContact(actorUserId: string, organizationId: string, contactId: string): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id, status: crmContact.status })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing || existing.status !== "ACTIVE") return { kind: "not_found" };

    await tx.update(crmContact).set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date() }).where(eq(crmContact.id, contactId));
    await logActivity(tx, contactId, actorUserId, "CONTACT_ARCHIVED");
    await tx.insert(auditLogs).values({ actorUserId, action: "crm.contact.archive", entityType: "crm_contact", entityId: contactId });
    return { kind: "ok", id: contactId };
  });
}

export async function restoreCrmContact(actorUserId: string, organizationId: string, contactId: string): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id, status: crmContact.status })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing || existing.status !== "ARCHIVED") return { kind: "not_found" };

    await tx.update(crmContact).set({ status: "ACTIVE", archivedAt: null, updatedAt: new Date() }).where(eq(crmContact.id, contactId));
    await logActivity(tx, contactId, actorUserId, "CONTACT_RESTORED");
    await tx.insert(auditLogs).values({ actorUserId, action: "crm.contact.restore", entityType: "crm_contact", entityId: contactId });
    return { kind: "ok", id: contactId };
  });
}

/** Manual linking only — never creates an account, never invites, never auto-matches by email/phone. */
export async function linkCrmContactUser(
  actorUserId: string,
  organizationId: string,
  contactId: string,
  linkedUserId: string,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };

    try {
      await tx.update(crmContact).set({ linkedUserId, updatedAt: new Date() }).where(eq(crmContact.id, contactId));
    } catch {
      return { kind: "conflict" };
    }
    await logActivity(tx, contactId, actorUserId, "USER_LINKED", { linkedUserId });
    await tx.insert(auditLogs).values({ actorUserId, action: "crm.contact.linkUser", entityType: "crm_contact", entityId: contactId, metadata: { linkedUserId } });
    return { kind: "ok", id: contactId };
  });
}

export async function unlinkCrmContactUser(actorUserId: string, organizationId: string, contactId: string): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };

    await tx.update(crmContact).set({ linkedUserId: null, updatedAt: new Date() }).where(eq(crmContact.id, contactId));
    await logActivity(tx, contactId, actorUserId, "USER_UNLINKED");
    await tx.insert(auditLogs).values({ actorUserId, action: "crm.contact.unlinkUser", entityType: "crm_contact", entityId: contactId });
    return { kind: "ok", id: contactId };
  });
}

/** The assignee must be an ACTIVE member of the same organization — verified from the DB, never trusted from the client. */
export async function assignCrmContact(
  actorUserId: string,
  organizationId: string,
  contactId: string,
  assignedToUserId: string | null,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };

    if (assignedToUserId && !(await isActiveOrgMember(tx, organizationId, assignedToUserId))) {
      return { kind: "invalid_assignee" };
    }

    await tx.update(crmContact).set({ assignedToUserId, updatedAt: new Date() }).where(eq(crmContact.id, contactId));
    await logActivity(tx, contactId, actorUserId, "ASSIGNEE_CHANGED", { assignedToUserId });
    return { kind: "ok", id: contactId };
  });
}

/**
 * The stage's `organization_id` (denormalized on `crm_pipeline_stage`) is
 * checked against the contact's own `organizationId` here, and the DB's
 * composite FK (`crm_contact_stage_org_fk`) enforces the same invariant at
 * the storage layer — a contact can never end up pointing at a foreign
 * organization/pipeline's stage even under a race or a bypassed check.
 */
export async function moveCrmContactStage(
  actorUserId: string,
  organizationId: string,
  contactId: string,
  stageId: string,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id, currentStageId: crmContact.currentStageId })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };

    const [stage] = await tx
      .select({ id: crmPipelineStage.id })
      .from(crmPipelineStage)
      .where(and(eq(crmPipelineStage.id, stageId), eq(crmPipelineStage.organizationId, organizationId)))
      .limit(1);
    if (!stage) return { kind: "invalid_stage" };

    await tx.update(crmContact).set({ currentStageId: stageId, updatedAt: new Date() }).where(eq(crmContact.id, contactId));
    await logActivity(tx, contactId, actorUserId, "STAGE_CHANGED", { from: existing.currentStageId, to: stageId });
    return { kind: "ok", id: contactId };
  });
}

export async function addCrmContactNote(
  actorUserId: string,
  organizationId: string,
  contactId: string,
  body: string,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };

    const [note] = await tx.insert(crmContactNote).values({ contactId, authorUserId: actorUserId, body }).returning();
    await logActivity(tx, contactId, actorUserId, "NOTE_ADDED", { noteId: note.id });
    return { kind: "ok", id: note.id };
  });
}

export async function createCrmTag(actorUserId: string, organizationId: string, name: string): Promise<MutationResult> {
  try {
    const [tag] = await db.insert(crmTag).values({ organizationId, name }).returning();
    return { kind: "ok", id: tag.id };
  } catch {
    return { kind: "conflict" };
  }
}

export async function attachCrmContactTag(
  actorUserId: string,
  organizationId: string,
  contactId: string,
  tagId: string,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [contact] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact) return { kind: "not_found" };

    const [tag] = await tx
      .select({ id: crmTag.id })
      .from(crmTag)
      .where(and(eq(crmTag.id, tagId), eq(crmTag.organizationId, organizationId)))
      .limit(1);
    if (!tag) return { kind: "not_found" };

    await tx.insert(crmContactTag).values({ contactId, tagId }).onConflictDoNothing();
    await logActivity(tx, contactId, actorUserId, "TAG_ATTACHED", { tagId });
    return { kind: "ok", id: contactId };
  });
}

export async function detachCrmContactTag(
  actorUserId: string,
  organizationId: string,
  contactId: string,
  tagId: string,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [contact] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact) return { kind: "not_found" };

    await tx.delete(crmContactTag).where(and(eq(crmContactTag.contactId, contactId), eq(crmContactTag.tagId, tagId)));
    await logActivity(tx, contactId, actorUserId, "TAG_DETACHED", { tagId });
    return { kind: "ok", id: contactId };
  });
}

export async function createCrmPipeline(actorUserId: string, organizationId: string, name: string): Promise<MutationResult> {
  try {
    const [pipeline] = await db.insert(crmPipeline).values({ organizationId, name }).returning();
    return { kind: "ok", id: pipeline.id };
  } catch {
    return { kind: "conflict" };
  }
}

export async function createCrmPipelineStage(
  actorUserId: string,
  organizationId: string,
  pipelineId: string,
  name: string,
  position: number,
): Promise<MutationResult> {
  const [pipeline] = await db
    .select({ id: crmPipeline.id })
    .from(crmPipeline)
    .where(and(eq(crmPipeline.id, pipelineId), eq(crmPipeline.organizationId, organizationId)))
    .limit(1);
  if (!pipeline) return { kind: "not_found" };

  try {
    const [stage] = await db.insert(crmPipelineStage).values({ pipelineId, organizationId, name, position }).returning();
    return { kind: "ok", id: stage.id };
  } catch {
    return { kind: "conflict" };
  }
}
