import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { courses, teacherCourseAssignment } from "@/server/db/schema";

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
