import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types";
import { getRetriever } from "@/server/ai/retriever";
import { getLearningCourse, getLearningCourses } from "@/server/queries/account";

const SearchKnowledgeInput = z.object({
  query: z.string().min(1).max(500),
  courseId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(10).default(5),
});
type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInput>;

const SearchKnowledgeOutput = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      score: z.number(),
      source: z.string(),
      courseId: z.string().optional(),
      resourceId: z.string().optional(),
    })
  ),
});
type SearchKnowledgeOutput = z.infer<typeof SearchKnowledgeOutput>;

export const searchKnowledgeTool: ToolDefinition<typeof SearchKnowledgeInput, typeof SearchKnowledgeOutput> = {
  name: "search_knowledge",
  description: "Search the knowledge base for relevant information. Use for answering questions about courses, policies, procedures, or general ANEI information.",
  riskLevel: "READ",
  inputSchema: SearchKnowledgeInput,
  outputSchema: SearchKnowledgeOutput,
  requiresConfirmation: false,
  authorize: async (_context: ToolContext) => {
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: SearchKnowledgeInput) => {
    const retriever = getRetriever();
    const results = await retriever.search({
      query: input.query,
      locale: context.locale,
      userId: context.userId,
      courseId: input.courseId,
      limit: input.limit,
    });
    return {
      results: results.map((r) => ({
        id: r.id,
        text: r.text,
        score: r.score,
        source: r.source,
        courseId: r.courseId,
        resourceId: r.resourceId,
      })),
    };
  },
};

const GetMyCoursesInput = z.object({});
type GetMyCoursesInput = z.infer<typeof GetMyCoursesInput>;

const GetMyCoursesOutput = z.object({
  courses: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      titleFr: z.string(),
      titleAr: z.string(),
      progressPercent: z.number(),
      status: z.string(),
    })
  ),
});
type GetMyCoursesOutput = z.infer<typeof GetMyCoursesOutput>;

export const getMyCoursesTool: ToolDefinition<typeof GetMyCoursesInput, typeof GetMyCoursesOutput> = {
  name: "get_my_courses",
  description: "Get the current user's enrolled courses with progress information.",
  riskLevel: "READ",
  inputSchema: GetMyCoursesInput,
  outputSchema: GetMyCoursesOutput,
  requiresConfirmation: false,
  authorize: async (_context: ToolContext) => {
    return { allowed: true };
  },
  execute: async (context: ToolContext) => {
    const courses = await getLearningCourses(context.userId);
    return {
      courses: courses.map((c) => ({
        id: c.id,
        slug: c.slug,
        titleFr: c.titleFr,
        titleAr: c.titleAr,
        progressPercent: c.progressPercent,
        status: c.status,
      })),
    };
  },
};

const ListMyAppointmentsInput = z.object({
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});
type ListMyAppointmentsInput = z.infer<typeof ListMyAppointmentsInput>;

const ListMyAppointmentsOutput = z.object({
  appointments: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      startAt: z.string(),
      endAt: z.string(),
      status: z.string(),
      contactName: z.string().optional(),
    })
  ),
});
type ListMyAppointmentsOutput = z.infer<typeof ListMyAppointmentsOutput>;

export const listMyAppointmentsTool: ToolDefinition<typeof ListMyAppointmentsInput, typeof ListMyAppointmentsOutput> = {
  name: "list_my_appointments",
  description: "List the current user's appointments (as staff/assessor).",
  riskLevel: "READ",
  inputSchema: ListMyAppointmentsInput,
  outputSchema: ListMyAppointmentsOutput,
  requiresConfirmation: false,
  authorize: async (_context: ToolContext) => {
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: ListMyAppointmentsInput) => {
    const { searchAppointments } = await import("@/server/queries/admission");
    const result = await searchAppointments({
      organizationId: context.organizationId ?? "",
      status: input.status,
      assignedToUserId: context.userId,
      pageSize: input.limit,
      page: 1,
    });
    return {
      appointments: result.items.map((a) => ({
        id: a.id,
        type: a.type,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        status: a.status,
        contactName: a.contactFirstName ? `${a.contactFirstName} ${a.contactLastName}` : undefined,
      })),
    };
  },
};

const GetCourseDetailsInput = z.object({
  courseId: z.string().uuid(),
});
type GetCourseDetailsInput = z.infer<typeof GetCourseDetailsInput>;

const GetCourseDetailsOutput = z.object({
  course: z.object({
    id: z.string(),
    slug: z.string(),
    titleFr: z.string(),
    titleAr: z.string(),
    descriptionFr: z.string(),
    descriptionAr: z.string(),
    category: z.string(),
    level: z.string(),
    durationMinutes: z.number(),
    modules: z.array(
      z.object({
        id: z.string(),
        position: z.number(),
        titleFr: z.string(),
        titleAr: z.string(),
        lessons: z.array(
          z.object({
            id: z.string(),
            position: z.number(),
            titleFr: z.string(),
            titleAr: z.string(),
            durationSeconds: z.number(),
            preview: z.boolean(),
          })
        ),
      })
    ),
  }).nullable(),
});
type GetCourseDetailsOutput = z.infer<typeof GetCourseDetailsOutput>;

export const getCourseDetailsTool: ToolDefinition<typeof GetCourseDetailsInput, typeof GetCourseDetailsOutput> = {
  name: "get_course_details",
  description: "Get detailed information about a specific course including modules and lessons.",
  riskLevel: "READ",
  inputSchema: GetCourseDetailsInput,
  outputSchema: GetCourseDetailsOutput,
  requiresConfirmation: false,
  authorize: async (_context: ToolContext, input: GetCourseDetailsInput) => {
    const courseData = await getLearningCourse(_context.userId, input.courseId);
    return { allowed: !!courseData };
  },
  execute: async (context: ToolContext, input: GetCourseDetailsInput) => {
    const courseData = await getLearningCourse(context.userId, input.courseId);
    if (!courseData) {
      return { course: null };
    }
    const course = courseData.course;
    return {
      course: {
        id: course.id,
        slug: course.slug,
        titleFr: course.titleFr,
        titleAr: course.titleAr,
        descriptionFr: course.descriptionFr,
        descriptionAr: course.descriptionAr,
        category: course.category,
        level: course.level,
        durationMinutes: course.durationMinutes,
        modules: courseData.modules.map((m) => ({
          id: m.id,
          position: m.position,
          titleFr: m.titleFr,
          titleAr: m.titleAr,
          lessons: courseData.lessons
            .filter((l) => l.moduleId === m.id)
            .map((l) => ({
              id: l.id,
              position: l.position,
              titleFr: l.titleFr,
              titleAr: l.titleAr,
              durationSeconds: l.durationSeconds,
              preview: l.preview,
            })),
        })),
      },
    };
  },
};