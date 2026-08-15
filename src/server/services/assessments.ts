import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  appointment,
  assessment,
  auditLogs,
  crmContact,
  crmContactActivity,
  organizationMembership,
  type AssessmentRow,
} from "@/server/db/schema";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";
import { canManageAssessments } from "@/modules/admission/domain/permissions";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type AssessmentMutationResult =
  | { kind: "ok"; id: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_contact" }
  | { kind: "invalid_appointment" }
  | { kind: "invalid_assessor" }
  | { kind: "invalid_transition" }
  | { kind: "invalid_score" };

/** Active organization membership check — same primitive as the CRM/appointment services. */
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
 * STAFF members manage only the assessments they personally assess;
 * MANAGER and above manage every assessment in the organization.
 */
function canManageAssessment(actorRole: OrganizationRole, actorUserId: string, assessorUserId: string): boolean {
  if (actorRole === "OWNER" || actorRole === "MANAGER") return true;
  if (actorRole === "STAFF") return actorUserId === assessorUserId;
  return false;
}

/**
 * Creates a DRAFT assessment for a contact. Contact and optional appointment
 * must belong to the same organization (composite FKs enforce this at the DB
 * level too). The assessor must be an ACTIVE member of the organization.
 */
export async function createAssessment(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  data: {
    contactId: string;
    appointmentId?: string | null;
    assessorUserId?: string | null;
    score?: number | null;
    maxScore?: number | null;
    summary?: string | null;
  },
): Promise<AssessmentMutationResult> {
  if (!canManageAssessments(actorRole)) return { kind: "forbidden" };

  return db.transaction(async (tx) => {
    const [contact] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, data.contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact) return { kind: "invalid_contact" };

    const assessorUserId = data.assessorUserId ?? actorUserId;
    if (actorRole === "STAFF" && assessorUserId !== actorUserId) return { kind: "forbidden" };
    if (!(await isActiveOrgMember(tx, organizationId, assessorUserId))) return { kind: "invalid_assessor" };

    if (data.appointmentId) {
      const [appt] = await tx
        .select({ id: appointment.id })
        .from(appointment)
        .where(and(eq(appointment.id, data.appointmentId), eq(appointment.organizationId, organizationId)))
        .limit(1);
      if (!appt) return { kind: "invalid_appointment" };
    }

    const [row] = await tx
      .insert(assessment)
      .values({
        organizationId,
        contactId: data.contactId,
        appointmentId: data.appointmentId ?? null,
        assessorUserId,
        status: "DRAFT",
        score: data.score ?? null,
        maxScore: data.maxScore ?? null,
        summary: data.summary ?? null,
      })
      .returning();

    await tx.insert(crmContactActivity).values({
      contactId: data.contactId,
      actorUserId,
      type: "ASSESSMENT_CREATED",
      metadata: { assessmentId: row.id, assessorUserId },
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.assessment.create",
      entityType: "assessment",
      entityId: row.id,
      metadata: { organizationId, contactId: data.contactId },
    });
    return { kind: "ok", id: row.id };
  });
}

/** Updates a DRAFT assessment. COMPLETED assessments are immutable (no re-edit path). */
export async function updateAssessment(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  assessmentId: string,
  data: { score?: number | null; maxScore?: number | null; summary?: string | null },
): Promise<AssessmentMutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(assessment)
      .where(and(eq(assessment.id, assessmentId), eq(assessment.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    if (!canManageAssessment(actorRole, actorUserId, existing.assessorUserId)) return { kind: "forbidden" };
    if (existing.status !== "DRAFT") return { kind: "invalid_transition" };

    const score = data.score ?? existing.score;
    const maxScore = data.maxScore ?? existing.maxScore;
    if (score !== null && maxScore !== null && score > maxScore) return { kind: "invalid_score" };
    if (score !== null && score < 0) return { kind: "invalid_score" };

    await tx
      .update(assessment)
      .set({
        score,
        maxScore,
        summary: data.summary ?? existing.summary,
        updatedAt: new Date(),
      })
      .where(eq(assessment.id, assessmentId));
    return { kind: "ok", id: assessmentId };
  });
}

/** DRAFT -> COMPLETED, recorded with completedAt. Completed content is immutable. */
export async function completeAssessment(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  assessmentId: string,
): Promise<AssessmentMutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(assessment)
      .where(and(eq(assessment.id, assessmentId), eq(assessment.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    if (!canManageAssessment(actorRole, actorUserId, existing.assessorUserId)) return { kind: "forbidden" };
    if (existing.status !== "DRAFT") return { kind: "invalid_transition" };

    const score = existing.score;
    const maxScore = existing.maxScore;
    if (score !== null && maxScore !== null && score > maxScore) return { kind: "invalid_score" };

    await tx
      .update(assessment)
      .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(assessment.id, assessmentId));
    await tx.insert(crmContactActivity).values({
      contactId: existing.contactId,
      actorUserId,
      type: "ASSESSMENT_COMPLETED",
      metadata: { assessmentId },
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.assessment.complete",
      entityType: "assessment",
      entityId: assessmentId,
      metadata: { organizationId },
    });
    return { kind: "ok", id: assessmentId };
  });
}

export type { AssessmentRow, AssessmentMutationResult };