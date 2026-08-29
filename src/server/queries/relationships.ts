import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  avsStudentAssignment,
  courses,
  enrollments,
  parentStudentLink,
  specialistStudentAssignment,
  user,
} from "@/server/db/schema";

/**
 * Every check below is keyed off the caller's own `userId` (never a client-
 * supplied one) and requires ACTIVE status — a PENDING/REVOKED/ENDED row
 * grants no access. Mirrors getPurchasedResourceForDownload's shape: the
 * target id is checked *against* rows owned by the caller, never trusted as
 * the sole authorization input (docs/premium/SECURITY_MODEL.md §2).
 */
export async function hasActiveParentLink(parentUserId: string, studentUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: parentStudentLink.id })
    .from(parentStudentLink)
    .where(
      and(
        eq(parentStudentLink.parentUserId, parentUserId),
        eq(parentStudentLink.studentUserId, studentUserId),
        eq(parentStudentLink.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasActiveAvsAssignment(avsUserId: string, studentUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: avsStudentAssignment.id })
    .from(avsStudentAssignment)
    .where(
      and(
        eq(avsStudentAssignment.avsUserId, avsUserId),
        eq(avsStudentAssignment.studentUserId, studentUserId),
        eq(avsStudentAssignment.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasActiveSpecialistAssignment(specialistUserId: string, studentUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: specialistStudentAssignment.id })
    .from(specialistStudentAssignment)
    .where(
      and(
        eq(specialistStudentAssignment.specialistUserId, specialistUserId),
        eq(specialistStudentAssignment.studentUserId, studentUserId),
        eq(specialistStudentAssignment.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Students linked to this parent with an ACTIVE relationship — drives the parent portal. */
export async function getLinkedStudentsForParent(parentUserId: string) {
  return db
    .select({ link: parentStudentLink, student: user })
    .from(parentStudentLink)
    .innerJoin(user, eq(user.id, parentStudentLink.studentUserId))
    .where(and(eq(parentStudentLink.parentUserId, parentUserId), eq(parentStudentLink.status, "ACTIVE")));
}

/**
 * Bounded course-progress overview for the parent dashboard: the caller's own
 * ACTIVE-linked children with their current enrollment progress. Scoped by
 * parent_student_link (never a client-supplied child list), inner-joined to
 * enrollments so only children who are actually enrolled appear — same
 * hasActiveParentLink authorization anchor as the rest of this file.
 */
export async function getLinkedStudentsProgressForParent(parentUserId: string) {
  return db
    .select({
      studentId: user.id,
      studentName: user.name,
      courseId: courses.id,
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
      progressPercent: enrollments.progressPercent,
      status: enrollments.status,
    })
    .from(parentStudentLink)
    .innerJoin(user, eq(user.id, parentStudentLink.studentUserId))
    .innerJoin(enrollments, eq(enrollments.userId, parentStudentLink.studentUserId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(eq(parentStudentLink.parentUserId, parentUserId), eq(parentStudentLink.status, "ACTIVE")))
    .orderBy(user.name, courses.titleFr)
    .limit(60);
}

/** Students assigned to this AVS with an ACTIVE assignment — drives the AVS portal. */
export async function getAssignedStudentsForAvs(avsUserId: string) {
  return db
    .select({ assignment: avsStudentAssignment, student: user })
    .from(avsStudentAssignment)
    .innerJoin(user, eq(user.id, avsStudentAssignment.studentUserId))
    .where(and(eq(avsStudentAssignment.avsUserId, avsUserId), eq(avsStudentAssignment.status, "ACTIVE")));
}

/** Students assigned to this specialist with an ACTIVE assignment — drives the specialist portal. */
export async function getAssignedStudentsForSpecialist(specialistUserId: string) {
  return db
    .select({ assignment: specialistStudentAssignment, student: user })
    .from(specialistStudentAssignment)
    .innerJoin(user, eq(user.id, specialistStudentAssignment.studentUserId))
    .where(
      and(
        eq(specialistStudentAssignment.specialistUserId, specialistUserId),
        eq(specialistStudentAssignment.status, "ACTIVE"),
      ),
    );
}
