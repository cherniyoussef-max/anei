import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, courses, teacherCourseAssignment } from "@/server/db/schema";
import { hasActivePersona } from "@/server/queries/personas";

type MutationResult = { kind: "ok"; id: string } | { kind: "not_found" } | { kind: "invalid_persona" } | { kind: "invalid_course" };

/**
 * Creates a teacher<->course assignment. Requires an ACTIVE TEACHER persona
 * (a TEACHER persona alone grants no course access — see
 * docs/premium/ROADMAP.md Phase 7 §K/§L) and a course that actually exists.
 * `organizationId` scopes the assignment for org-scoped roster queries but
 * never gates the check itself — the caller (an admin/org-manager session,
 * checked at the route) is always distinct from teacherUserId.
 */
export async function assignTeacher(
  actorUserId: string,
  teacherUserId: string,
  courseId: string,
  organizationId: string | null,
): Promise<MutationResult> {
  const [teacherOk, course] = await Promise.all([
    hasActivePersona(teacherUserId, "TEACHER"),
    db.query.courses.findFirst({ where: eq(courses.id, courseId) }),
  ]);
  if (!teacherOk) return { kind: "invalid_persona" };
  if (!course) return { kind: "invalid_course" };

  return db.transaction(async (tx) => {
    const [assignment] = await tx
      .insert(teacherCourseAssignment)
      .values({ teacherUserId, courseId, organizationId, status: "ACTIVE", createdBy: actorUserId })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "relationship.teacherAssignment.create",
      entityType: "teacher_course_assignment",
      entityId: assignment.id,
      metadata: { teacherUserId, courseId, organizationId },
    });
    return { kind: "ok", id: assignment.id };
  });
}

export async function endTeacherAssignment(actorUserId: string, assignmentId: string): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: teacherCourseAssignment.id })
      .from(teacherCourseAssignment)
      .where(and(eq(teacherCourseAssignment.id, assignmentId), eq(teacherCourseAssignment.status, "ACTIVE")))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    await tx
      .update(teacherCourseAssignment)
      .set({ status: "ENDED", updatedAt: new Date() })
      .where(eq(teacherCourseAssignment.id, assignmentId));
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "relationship.teacherAssignment.end",
      entityType: "teacher_course_assignment",
      entityId: assignmentId,
    });
    return { kind: "ok", id: assignmentId };
  });
}
