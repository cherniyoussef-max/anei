import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  avsStudentAssignment,
  parentStudentLink,
  specialistStudentAssignment,
} from "@/server/db/schema";
import { hasActivePersona } from "@/server/queries/personas";
import type { ParentLinkStatus, ParentRelationshipType } from "@/modules/relationships/domain/permissions";

type MutationResult = { kind: "ok"; id: string } | { kind: "not_found" } | { kind: "invalid_persona" };

/**
 * Admin-managed only (no self-invitation in Phase 2) — the caller (an admin
 * session, checked at the route) is always distinct from parentUserId, which
 * is enforced by never letting a route derive parentUserId from anywhere but
 * an explicit admin-supplied target, plus the DB's own self-reference CHECK.
 *
 * Requires both participants to actually hold the ACTIVE persona the row
 * implies (PARENT / STUDENT) before insert — an ACTIVE relationship row
 * between two arbitrary users would otherwise be valid domain data by the
 * DB's standards alone, even though runtime access checks
 * (`requireActivePersona`) only ever verify the *caller's* own persona, not
 * the other participant's.
 */
export async function createParentStudentLink(
  actorUserId: string,
  parentUserId: string,
  studentUserId: string,
  relationshipType: ParentRelationshipType,
): Promise<MutationResult> {
  const [parentOk, studentOk] = await Promise.all([
    hasActivePersona(parentUserId, "PARENT"),
    hasActivePersona(studentUserId, "STUDENT"),
  ]);
  if (!parentOk || !studentOk) return { kind: "invalid_persona" };

  return db.transaction(async (tx) => {
    const [link] = await tx
      .insert(parentStudentLink)
      .values({ parentUserId, studentUserId, relationshipType, status: "PENDING", createdBy: actorUserId })
      .onConflictDoUpdate({
        target: [parentStudentLink.parentUserId, parentStudentLink.studentUserId],
        set: { relationshipType, updatedAt: new Date() },
      })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "relationship.parentLink.create",
      entityType: "parent_student_link",
      entityId: link.id,
      metadata: { parentUserId, studentUserId, relationshipType },
    });
    return { kind: "ok", id: link.id };
  });
}

export async function setParentStudentLinkStatus(
  actorUserId: string,
  linkId: string,
  status: ParentLinkStatus,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: parentStudentLink.id }).from(parentStudentLink).where(eq(parentStudentLink.id, linkId)).limit(1);
    if (!existing) return { kind: "not_found" };
    await tx.update(parentStudentLink).set({ status, updatedAt: new Date() }).where(eq(parentStudentLink.id, linkId));
    await tx.insert(auditLogs).values({
      actorUserId,
      action: `relationship.parentLink.${status.toLowerCase()}`,
      entityType: "parent_student_link",
      entityId: linkId,
      metadata: { status },
    });
    return { kind: "ok", id: linkId };
  });
}

/**
 * Creates (or reactivates) an AVS<->student assignment. Ending a prior ACTIVE
 * assignment is a separate call — history is never overwritten. Requires an
 * ACTIVE AVS persona and an ACTIVE STUDENT persona (see
 * `createParentStudentLink` for why).
 */
export async function createAvsAssignment(actorUserId: string, avsUserId: string, studentUserId: string): Promise<MutationResult> {
  const [avsOk, studentOk] = await Promise.all([
    hasActivePersona(avsUserId, "AVS"),
    hasActivePersona(studentUserId, "STUDENT"),
  ]);
  if (!avsOk || !studentOk) return { kind: "invalid_persona" };

  return db.transaction(async (tx) => {
    const [assignment] = await tx
      .insert(avsStudentAssignment)
      .values({ avsUserId, studentUserId, status: "ACTIVE", createdBy: actorUserId })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "relationship.avsAssignment.create",
      entityType: "avs_student_assignment",
      entityId: assignment.id,
      metadata: { avsUserId, studentUserId },
    });
    return { kind: "ok", id: assignment.id };
  });
}

export async function endAvsAssignment(actorUserId: string, assignmentId: string): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: avsStudentAssignment.id })
      .from(avsStudentAssignment)
      .where(and(eq(avsStudentAssignment.id, assignmentId), eq(avsStudentAssignment.status, "ACTIVE")))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    await tx.update(avsStudentAssignment).set({ status: "ENDED", endDate: new Date(), updatedAt: new Date() }).where(eq(avsStudentAssignment.id, assignmentId));
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "relationship.avsAssignment.end",
      entityType: "avs_student_assignment",
      entityId: assignmentId,
    });
    return { kind: "ok", id: assignmentId };
  });
}

/** Same persona-integrity requirement as `createAvsAssignment`: ACTIVE SPECIALIST + ACTIVE STUDENT. */
export async function createSpecialistAssignment(actorUserId: string, specialistUserId: string, studentUserId: string): Promise<MutationResult> {
  const [specialistOk, studentOk] = await Promise.all([
    hasActivePersona(specialistUserId, "SPECIALIST"),
    hasActivePersona(studentUserId, "STUDENT"),
  ]);
  if (!specialistOk || !studentOk) return { kind: "invalid_persona" };

  return db.transaction(async (tx) => {
    const [assignment] = await tx
      .insert(specialistStudentAssignment)
      .values({ specialistUserId, studentUserId, status: "ACTIVE", createdBy: actorUserId })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "relationship.specialistAssignment.create",
      entityType: "specialist_student_assignment",
      entityId: assignment.id,
      metadata: { specialistUserId, studentUserId },
    });
    return { kind: "ok", id: assignment.id };
  });
}

export async function endSpecialistAssignment(actorUserId: string, assignmentId: string): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: specialistStudentAssignment.id })
      .from(specialistStudentAssignment)
      .where(and(eq(specialistStudentAssignment.id, assignmentId), eq(specialistStudentAssignment.status, "ACTIVE")))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    await tx.update(specialistStudentAssignment).set({ status: "ENDED", endDate: new Date(), updatedAt: new Date() }).where(eq(specialistStudentAssignment.id, assignmentId));
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "relationship.specialistAssignment.end",
      entityType: "specialist_student_assignment",
      entityId: assignmentId,
    });
    return { kind: "ok", id: assignmentId };
  });
}
