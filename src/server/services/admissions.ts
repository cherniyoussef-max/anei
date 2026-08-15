import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  admission,
  assessment,
  auditLogs,
  crmContact,
  crmContactActivity,
  type AdmissionRow,
} from "@/server/db/schema";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";
import { canFinalizeAdmission, type AdmissionDecision } from "@/modules/admission/domain/permissions";

type AdmissionMutationResult =
  | { kind: "ok"; id: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_contact" }
  | { kind: "invalid_assessment" }
  | { kind: "invalid_transition" };

/**
 * Creates a PENDING admission record for a contact. The assessment, when
 * provided, must belong to the same organization (composite FK enforced at
 * the DB level too). Contact creation is allowed at STAFF+ via
 * canManageAssessments; finalization is MANAGER+ (see canFinalizeAdmission).
 */
export async function createAdmission(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  data: { contactId: string; assessmentId?: string | null; reason?: string | null },
): Promise<AdmissionMutationResult> {
  if (actorRole !== "OWNER" && actorRole !== "MANAGER" && actorRole !== "STAFF") return { kind: "forbidden" };

  return db.transaction(async (tx) => {
    const [contact] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, data.contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact) return { kind: "invalid_contact" };

    if (data.assessmentId) {
      const [assessmentRow] = await tx
        .select({ id: assessment.id })
        .from(assessment)
        .where(and(eq(assessment.id, data.assessmentId), eq(assessment.organizationId, organizationId)))
        .limit(1);
      if (!assessmentRow) return { kind: "invalid_assessment" };
    }

    const [row] = await tx
      .insert(admission)
      .values({
        organizationId,
        contactId: data.contactId,
        assessmentId: data.assessmentId ?? null,
        reason: data.reason ?? null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.admission.create",
      entityType: "admission",
      entityId: row.id,
      metadata: { organizationId, contactId: data.contactId },
    });
    return { kind: "ok", id: row.id };
  });
}

/**
 * Finalizes a PENDING admission to ACCEPTED/REJECTED exactly once — terminal
 * decisions are immutable. The invitation boundary (creating the user
 * account, sending invitations, enrollment) is OUT OF SCOPE and handled in a
 * later phase; this service stops at the decision.
 */
export async function decideAdmission(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  admissionId: string,
  decision: AdmissionDecision,
  reason?: string | null,
): Promise<AdmissionMutationResult> {
  if (!canFinalizeAdmission(actorRole)) return { kind: "forbidden" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(admission)
      .where(and(eq(admission.id, admissionId), eq(admission.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    if (existing.decision !== "PENDING") return { kind: "invalid_transition" };

    await tx
      .update(admission)
      .set({
        decision,
        decidedByUserId: actorUserId,
        reason: reason ?? null,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(admission.id, admissionId));

    await tx.insert(crmContactActivity).values({
      contactId: existing.contactId,
      actorUserId,
      type: decision === "ACCEPTED" ? "ADMISSION_ACCEPTED" : "ADMISSION_REJECTED",
      metadata: { admissionId, reason: reason ?? null },
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: `crm.admission.${decision.toLowerCase()}`,
      entityType: "admission",
      entityId: admissionId,
      metadata: { organizationId, contactId: existing.contactId },
    });
    return { kind: "ok", id: admissionId };
  });
}

/**
 * READ-ONLY domain decision helper — the Phase 4 invitation boundary. It
 * answers "may this contact proceed to the (future) invitation flow?" with no
 * side effects: the contact must exist in the organization, be active, and
 * have an ACCEPTED admission. No user is created, no invitation is sent,
 * nothing is mutated.
 */
export async function canContactBeInvited(organizationId: string, contactId: string): Promise<boolean> {
  const [contact] = await db
    .select({ id: crmContact.id, status: crmContact.status })
    .from(crmContact)
    .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
    .limit(1);
  if (!contact || contact.status !== "ACTIVE") return false;

  const [accepted] = await db
    .select({ id: admission.id })
    .from(admission)
    .where(and(eq(admission.contactId, contactId), eq(admission.decision, "ACCEPTED")))
    .limit(1);
  return Boolean(accepted);
}

export type { AdmissionRow, AdmissionMutationResult };