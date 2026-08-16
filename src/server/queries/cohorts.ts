import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { cohort, cohortMembership, courses, enrollments, user } from "@/server/db/schema";

/** `organizationId` is always required for org-scoped listing; callers must already have verified the caller may act within it. */
export async function listCohorts(organizationId: string) {
  return db
    .select({ cohort, course: courses })
    .from(cohort)
    .innerJoin(courses, eq(cohort.courseId, courses.id))
    .where(eq(cohort.organizationId, organizationId))
    .orderBy(desc(cohort.createdAt));
}

export async function getCohort(organizationId: string, cohortId: string) {
  const [row] = await db
    .select({ cohort, course: courses })
    .from(cohort)
    .innerJoin(courses, eq(cohort.courseId, courses.id))
    .where(and(eq(cohort.id, cohortId), eq(cohort.organizationId, organizationId)))
    .limit(1);
  return row;
}

/** Cohort roster — student identity joined through the enrollment the cohort membership references, never a second student/course truth. */
export async function getCohortRoster(organizationId: string, cohortId: string) {
  const cohortRow = await getCohort(organizationId, cohortId);
  if (!cohortRow) return null;

  const roster = await db
    .select({ membership: cohortMembership, enrollment: enrollments, student: user })
    .from(cohortMembership)
    .innerJoin(enrollments, eq(cohortMembership.enrollmentId, enrollments.id))
    .innerJoin(user, eq(enrollments.userId, user.id))
    .where(eq(cohortMembership.cohortId, cohortId));

  return { cohort: cohortRow.cohort, course: cohortRow.course, roster };
}
