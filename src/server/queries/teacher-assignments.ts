import { and, count, countDistinct, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { cohort, courses, enrollments, teacherCourseAssignment } from "@/server/db/schema";

export async function listTeacherAssignments(organizationId: string) {
  return db
    .select({ assignment: teacherCourseAssignment, course: courses })
    .from(teacherCourseAssignment)
    .innerJoin(courses, eq(teacherCourseAssignment.courseId, courses.id))
    .where(eq(teacherCourseAssignment.organizationId, organizationId));
}

/**
 * Courses this teacher is actively assigned to teach — the "underlying
 * query" for the teacher roster view. `/teacher/cohortes` wiring is Phase 11
 * scope (docs/premium/ROADMAP.md Phase 7 UI note); this phase only needs the
 * query itself to exist and be IDOR-safe (scoped to `teacherUserId`, never a
 * client-supplied course list).
 */
export async function getAssignedCoursesForTeacher(teacherUserId: string) {
  return db
    .select({ assignment: teacherCourseAssignment, course: courses })
    .from(teacherCourseAssignment)
    .innerJoin(courses, eq(teacherCourseAssignment.courseId, courses.id))
    .where(and(eq(teacherCourseAssignment.teacherUserId, teacherUserId), eq(teacherCourseAssignment.status, "ACTIVE")));
}

/**
 * Count of distinct learners enrolled in this teacher's assigned courses -
 * a bounded aggregate, never a roster/PII listing (see the get_cohort_
 * information privacy note: teacher dashboard authorization must stay
 * anchored to teacherCourseAssignment, never a broad enrollment scan).
 */
export async function getAssignedLearnerCountForTeacher(teacherUserId: string): Promise<number> {
  const assignedCourses = await db
    .select({ courseId: teacherCourseAssignment.courseId })
    .from(teacherCourseAssignment)
    .where(and(eq(teacherCourseAssignment.teacherUserId, teacherUserId), eq(teacherCourseAssignment.status, "ACTIVE")));
  const courseIds = assignedCourses.map((row) => row.courseId);
  if (courseIds.length === 0) return 0;

  const [row] = await db
    .select({ count: countDistinct(enrollments.userId) })
    .from(enrollments)
    .where(inArray(enrollments.courseId, courseIds));
  return row?.count ?? 0;
}

/** Count of cohorts running on this teacher's assigned courses - bounded aggregate for the dashboard KPI row. */
export async function getCohortCountForTeacher(teacherUserId: string): Promise<number> {
  const assignedCourses = await db
    .select({ courseId: teacherCourseAssignment.courseId })
    .from(teacherCourseAssignment)
    .where(and(eq(teacherCourseAssignment.teacherUserId, teacherUserId), eq(teacherCourseAssignment.status, "ACTIVE")));
  const courseIds = assignedCourses.map((row) => row.courseId);
  if (courseIds.length === 0) return 0;

  const [row] = await db.select({ count: count() }).from(cohort).where(inArray(cohort.courseId, courseIds));
  return row?.count ?? 0;
}

export async function isTeacherAssignedToCourse(teacherUserId: string, courseId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: teacherCourseAssignment.id })
    .from(teacherCourseAssignment)
    .where(
      and(
        eq(teacherCourseAssignment.teacherUserId, teacherUserId),
        eq(teacherCourseAssignment.courseId, courseId),
        eq(teacherCourseAssignment.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return Boolean(row);
}
