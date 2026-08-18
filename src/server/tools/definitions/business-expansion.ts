import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types";
import { enrollStudent } from "@/server/services/enrollments";

// -----------------------------------------------------------------------------
// enroll_student — BUSINESS_WRITE (explicit confirmation always required).
// Reuses the existing Phase 7 enrollment service: the target userId is
// re-validated server-side (STUDENT persona), the course must exist, and an
// optional cohort must belong to the same course/organization. `source` is
// forced to ORGANIZATION server-side — never accepted from the model. The
// service's (userId, courseId) unique index makes the insert itself
// idempotent under duplicate confirmation.
// -----------------------------------------------------------------------------
const EnrollStudentInput = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  cohortId: z.string().uuid().optional(),
}).strict();
type EnrollStudentInput = z.infer<typeof EnrollStudentInput>;

const EnrollStudentOutput = z.object({
  enrollmentId: z.string(),
  created: z.boolean(),
});
type EnrollStudentOutput = z.infer<typeof EnrollStudentOutput>;

export const enrollStudentTool: ToolDefinition<typeof EnrollStudentInput, typeof EnrollStudentOutput> = {
  name: "enroll_student",
  description:
    "Enroll an existing STUDENT user into a course (optionally into a cohort of that course) within the current organization. Requires OWNER/MANAGER/STAFF organization role and explicit confirmation.",
  riskLevel: "BUSINESS_WRITE",
  inputSchema: EnrollStudentInput,
  outputSchema: EnrollStudentOutput,
  requiresConfirmation: true,
  canList: async (context: ToolContext) => {
    if (!context.organizationId || !context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false };
    }
    return { allowed: true };
  },
  authorize: async (context: ToolContext) => {
    if (!context.organizationId) {
      return { allowed: false, reason: "No organization context" };
    }
    if (!context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false, reason: "Insufficient organization role" };
    }
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: EnrollStudentInput) => {
    const result = await enrollStudent(context.userId, context.organizationId!, {
      userId: input.userId,
      courseId: input.courseId,
      cohortId: input.cohortId ?? null,
      source: "ORGANIZATION",
      contactId: null,
    });
    if (result.kind !== "ok") {
      throw new Error(`Failed to enroll student: ${result.kind}`);
    }
    return { enrollmentId: result.enrollmentId, created: result.created };
  },
};