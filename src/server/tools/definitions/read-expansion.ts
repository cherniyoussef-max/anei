import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types";
import { db } from "@/server/db";
import {
  cohort,
  cohortMembership,
  courses,
  enrollments,
  organizationMembership,
  user,
} from "@/server/db/schema";
import { hasActiveAvsAssignment, hasActiveParentLink, hasActiveSpecialistAssignment } from "@/server/queries/relationships";
import { isTeacherAssignedToCourse } from "@/server/queries/teacher-assignments";

// -----------------------------------------------------------------------------
// get_my_enrollments — READ, self only.
// -----------------------------------------------------------------------------
const GetMyEnrollmentsInput = z.object({}).strict();
type GetMyEnrollmentsInput = z.infer<typeof GetMyEnrollmentsInput>;

const GetMyEnrollmentsOutput = z.object({
  enrollments: z.array(
    z.object({
      enrollmentId: z.string(),
      courseId: z.string(),
      slug: z.string(),
      titleFr: z.string(),
      titleAr: z.string(),
      progressPercent: z.number(),
      status: z.string(),
      source: z.string(),
    })
  ),
});
type GetMyEnrollmentsOutput = z.infer<typeof GetMyEnrollmentsOutput>;

export const getMyEnrollmentsTool: ToolDefinition<typeof GetMyEnrollmentsInput, typeof GetMyEnrollmentsOutput> = {
  name: "get_my_enrollments",
  description: "Get the current user's enrollments with course and progress information.",
  riskLevel: "READ",
  inputSchema: GetMyEnrollmentsInput,
  outputSchema: GetMyEnrollmentsOutput,
  requiresConfirmation: false,
  authorize: async () => ({ allowed: true }),
  execute: async (context: ToolContext) => {
    const rows = await db
      .select({
        enrollmentId: enrollments.id,
        courseId: courses.id,
        slug: courses.slug,
        titleFr: courses.titleFr,
        titleAr: courses.titleAr,
        progressPercent: enrollments.progressPercent,
        status: enrollments.status,
        source: enrollments.source,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, context.userId))
      .orderBy(enrollments.enrolledAt);
    return {
      enrollments: rows.map((r) => ({
        enrollmentId: r.enrollmentId,
        courseId: r.courseId,
        slug: r.slug,
        titleFr: r.titleFr,
        titleAr: r.titleAr,
        progressPercent: r.progressPercent ?? 0,
        status: r.status,
        source: r.source,
      })),
    };
  },
};

// -----------------------------------------------------------------------------
// get_student_progress — READ, self OR authorized relationship (parent/AVS/
// specialist) OR teacher-of-a-course. Returns only the courses the actor is
// entitled to see for the target student.
// -----------------------------------------------------------------------------
const GetStudentProgressInput = z.object({ userId: z.string().uuid() }).strict();
type GetStudentProgressInput = z.infer<typeof GetStudentProgressInput>;

const GetStudentProgressOutput = z.object({
  studentId: z.string(),
  courses: z.array(
    z.object({
      courseId: z.string(),
      slug: z.string(),
      titleFr: z.string(),
      titleAr: z.string(),
      progressPercent: z.number(),
      status: z.string(),
    })
  ),
});
type GetStudentProgressOutput = z.infer<typeof GetStudentProgressOutput>;

async function resolveStudentAccess(
  actorUserId: string,
  targetUserId: string
): Promise<"self" | "parent" | "avs" | "specialist" | "teacher" | "none"> {
  if (actorUserId === targetUserId) return "self";
  if (await hasActiveParentLink(actorUserId, targetUserId)) return "parent";
  if (await hasActiveAvsAssignment(actorUserId, targetUserId)) return "avs";
  if (await hasActiveSpecialistAssignment(actorUserId, targetUserId)) return "specialist";
  return "none";
}

export const getStudentProgressTool: ToolDefinition<typeof GetStudentProgressInput, typeof GetStudentProgressOutput> = {
  name: "get_student_progress",
  description:
    "Get a student's course progress. Allowed for the student themself, an active parent/AVS/specialist relationship, or a teacher assigned to one of the student's courses.",
  riskLevel: "READ",
  inputSchema: GetStudentProgressInput,
  outputSchema: GetStudentProgressOutput,
  requiresConfirmation: false,
  authorize: async (context: ToolContext, input: GetStudentProgressInput) => {
    const access = await resolveStudentAccess(context.userId, input.userId);
    if (access !== "none") return { allowed: true };
    const enrolledCourses = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(eq(enrollments.userId, input.userId))
      .limit(20);
    for (const enrollment of enrolledCourses) {
      if (await isTeacherAssignedToCourse(context.userId, enrollment.courseId)) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: "No self/relationship/teacher entitlement to this student's progress" };
  },
  execute: async (context: ToolContext, input: GetStudentProgressInput) => {
    const access = await resolveStudentAccess(context.userId, input.userId);
    if (access === "none") {
      // Teacher case: an active assignment to any of the student's courses
      // grants access to exactly those courses the teacher teaches.
      const all = await db
        .select({
          courseId: courses.id,
          slug: courses.slug,
          titleFr: courses.titleFr,
          titleAr: courses.titleAr,
          progressPercent: enrollments.progressPercent,
          status: enrollments.status,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(enrollments.userId, input.userId));
      const filtered: typeof all = [];
      for (const row of all) {
        if (await isTeacherAssignedToCourse(context.userId, row.courseId)) filtered.push(row);
      }
      return {
        studentId: input.userId,
        courses: filtered.map((r) => ({
          courseId: r.courseId,
          slug: r.slug,
          titleFr: r.titleFr,
          titleAr: r.titleAr,
          progressPercent: r.progressPercent ?? 0,
          status: r.status,
        })),
      };
    }

    const rows = await db
      .select({
        courseId: courses.id,
        slug: courses.slug,
        titleFr: courses.titleFr,
        titleAr: courses.titleAr,
        progressPercent: enrollments.progressPercent,
        status: enrollments.status,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, input.userId));
    return {
      studentId: input.userId,
      courses: rows.map((r) => ({
        courseId: r.courseId,
        slug: r.slug,
        titleFr: r.titleFr,
        titleAr: r.titleAr,
        progressPercent: r.progressPercent ?? 0,
        status: r.status,
      })),
    };
  },
};

// -----------------------------------------------------------------------------
// get_cohort_information — READ, org member (any role) OR student enrolled in
// the cohort. Bounded roster output.
// -----------------------------------------------------------------------------
const GetCohortInformationInput = z.object({ cohortId: z.string().uuid() }).strict();
type GetCohortInformationInput = z.infer<typeof GetCohortInformationInput>;

const GetCohortInformationOutput = z.object({
  cohort: z.object({
    id: z.string(),
    name: z.string(),
    courseId: z.string(),
    courseSlug: z.string(),
    courseTitleFr: z.string(),
    courseTitleAr: z.string(),
    capacity: z.number().nullable(),
    memberCount: z.number(),
    roster: z.array(
      z.object({
        studentId: z.string(),
        studentName: z.string(),
        progressPercent: z.number(),
      })
    ),
  }).nullable(),
});
type GetCohortInformationOutput = z.infer<typeof GetCohortInformationOutput>;

export const getCohortInformationTool: ToolDefinition<typeof GetCohortInformationInput, typeof GetCohortInformationOutput> = {
  name: "get_cohort_information",
  description: "Get information about a cohort including its course, capacity and roster. Requires active membership of the cohort's organization or enrollment in the cohort.",
  riskLevel: "READ",
  inputSchema: GetCohortInformationInput,
  outputSchema: GetCohortInformationOutput,
  requiresConfirmation: false,
  authorize: async (context: ToolContext, input: GetCohortInformationInput) => {
    const [cohortRow] = await db
      .select({ id: cohort.id, organizationId: cohort.organizationId })
      .from(cohort)
      .where(eq(cohort.id, input.cohortId))
      .limit(1);
    if (!cohortRow) return { allowed: false, reason: "Cohort not found" };

    const [membership] = await db
      .select({ id: organizationMembership.id })
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.organizationId, cohortRow.organizationId ?? ""),
          eq(organizationMembership.userId, context.userId),
          eq(organizationMembership.status, "ACTIVE")
        )
      )
      .limit(1);
    if (membership) return { allowed: true };

    const [member] = await db
      .select({ id: cohortMembership.id, enrollmentId: cohortMembership.enrollmentId })
      .from(cohortMembership)
      .innerJoin(enrollments, eq(cohortMembership.enrollmentId, enrollments.id))
      .where(and(eq(cohortMembership.cohortId, input.cohortId), eq(enrollments.userId, context.userId)))
      .limit(1);
    return member
      ? { allowed: true }
      : { allowed: false, reason: "Not a member of the cohort's organization nor enrolled in the cohort" };
  },
  execute: async (context: ToolContext, input: GetCohortInformationInput) => {
    const [cohortRow] = await db
      .select()
      .from(cohort)
      .innerJoin(courses, eq(cohort.courseId, courses.id))
      .where(eq(cohort.id, input.cohortId))
      .limit(1);
    if (!cohortRow) return { cohort: null };

    const roster = await db
      .select({
        studentId: user.id,
        studentName: user.name,
        progressPercent: enrollments.progressPercent,
      })
      .from(cohortMembership)
      .innerJoin(enrollments, eq(cohortMembership.enrollmentId, enrollments.id))
      .innerJoin(user, eq(enrollments.userId, user.id))
      .where(eq(cohortMembership.cohortId, input.cohortId));

    return {
      cohort: {
        id: cohortRow.cohort.id,
        name: cohortRow.cohort.name,
        courseId: cohortRow.cohort.courseId,
        courseSlug: cohortRow.courses.slug,
        courseTitleFr: cohortRow.courses.titleFr,
        courseTitleAr: cohortRow.courses.titleAr,
        capacity: cohortRow.cohort.capacity,
        memberCount: roster.length,
        roster: roster.map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          progressPercent: r.progressPercent ?? 0,
        })),
      },
    };
  },
};