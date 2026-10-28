import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import {
  auditLogs,
  courses,
  learningAssessment,
  learningQuestion,
  learningQuestionOption,
} from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { syncCourseToActualites } from "@/server/services/auto-news-syndication";

export const finalAssessmentQuestionSchema = z
  .object({
    questionFr: z.string().trim().min(3).max(1000),
    questionAr: z.string().trim().min(3).max(1000),
    points: z.number().int().min(1).max(100).default(1),
    explanationFr: z.string().trim().max(1000).optional().nullable(),
    explanationAr: z.string().trim().max(1000).optional().nullable(),
    options: z
      .array(
        z
          .object({
            textFr: z.string().trim().min(1).max(500),
            textAr: z.string().trim().min(1).max(500),
          })
          .strict()
      )
      .min(2, "Au moins 2 options de réponse sont requises")
      .max(6),
    correctOptionIndex: z.number().int().min(0).max(5),
  })
  .strict()
  .refine((q) => q.correctOptionIndex < q.options.length, {
    message: "L'option correcte doit correspondre à l'une des options proposées",
  });

export const finalAssessmentInputSchema = z
  .object({
    timeLimitMinutes: z.number().int().min(5).max(180),
    passingScorePercent: z.number().int().min(50).max(100),
    revealAnswersAfterPass: z.boolean().default(false),
    questions: z
      .array(finalAssessmentQuestionSchema)
      .min(1, "Au moins 1 question QCM est obligatoire"),
  })
  .strict();

const schema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(3).max(120),
    titleFr: z.string().trim().min(3).max(180),
    titleAr: z.string().trim().min(3).max(180),
    summaryFr: z.string().trim().min(3).max(500),
    summaryAr: z.string().trim().min(3).max(500),
    descriptionFr: z.string().trim().min(3).max(10_000),
    descriptionAr: z.string().trim().min(3).max(10_000),
    category: z.string().trim().min(2).max(80),
    trainerName: z.string().trim().min(2).max(120),
    durationMinutes: z.number().int().positive().max(100_000),
    priceMillimes: z.number().int().nonnegative().max(100_000_000),
    level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
    mode: z.enum(["online", "hybrid", "onsite"]),
    published: z.boolean().default(false),
    featured: z.boolean().default(false),
    qualifiesForProfessionalPromotion: z.boolean().default(false),
    qualifyingTargetType: z.enum(["AVS", "SPECIALIST"]).nullable().optional(),
    qualifyingTargetCategory: z.string().trim().max(100).nullable().optional(),
    coverImageObjectKey: z
      .string()
      .min(3)
      .max(1024)
      .regex(/^[a-zA-Z0-9._\/-]+$/)
      .nullable()
      .optional(),
    objectives: z
      .object({
        fr: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
        ar: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
      })
      .strict(),
    finalAssessment: finalAssessmentInputSchema,
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const session = await getAdminSessionFor("courses.create");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const rawJson = await readLimitedJson(request).catch(() => null);

  // Check QCM presence explicitly
  if (!rawJson || typeof rawJson !== "object" || !("finalAssessment" in (rawJson as Record<string, unknown>))) {
    return NextResponse.json(
      {
        error: "ASSESSMENT_QCM_REQUIRED",
        message:
          "Chaque formation doit obligatoirement inclure un QCM d'évaluation finale chronométré avant d'être enregistrée.",
      },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(rawJson);
  if (!parsed.success) {
    const isQcmIssue = parsed.error.issues.some((issue) =>
      issue.path.includes("finalAssessment")
    );
    if (isQcmIssue) {
      return NextResponse.json(
        {
          error: "ASSESSMENT_QCM_REQUIRED",
          message:
            "Chaque formation doit obligatoirement inclure un QCM d'évaluation finale chronométré valide (durée, score de réussite et au moins 1 question complète).",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { coverImageObjectKey, finalAssessment, ...input } = parsed.data;

    const course = await db.transaction(async (tx) => {
      // 1. Create course
      const [newCourse] = await tx
        .insert(courses)
        .values({
          ...input,
          coverImage: coverImageObjectKey || null,
        })
        .returning();

      // 2. Create mandatory final assessment
      const [assessment] = await tx
        .insert(learningAssessment)
        .values({
          courseId: newCourse.id,
          titleFr: `Évaluation Finale : ${newCourse.titleFr}`,
          titleAr: `التقييم النهائي: ${newCourse.titleAr}`,
          timeLimitSeconds: finalAssessment.timeLimitMinutes * 60,
          passingScore: finalAssessment.passingScorePercent,
          maxAttempts: 5,
          published: true,
          revealAnswersAfterPass: finalAssessment.revealAnswersAfterPass,
        })
        .returning();

      // 3. Create questions and options
      for (let i = 0; i < finalAssessment.questions.length; i++) {
        const q = finalAssessment.questions[i];
        const [question] = await tx
          .insert(learningQuestion)
          .values({
            assessmentId: assessment.id,
            promptFr: q.questionFr,
            promptAr: q.questionAr,
            type: "SINGLE_CHOICE",
            position: i + 1,
            points: q.points ?? 1,
            explanationFr: q.explanationFr ?? null,
            explanationAr: q.explanationAr ?? null,
          })
          .returning();

        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j];
          await tx.insert(learningQuestionOption).values({
            questionId: question.id,
            textFr: opt.textFr,
            textAr: opt.textAr,
            position: j + 1,
            isCorrect: j === q.correctOptionIndex,
          });
        }
      }

      await tx.insert(auditLogs).values({
        actorUserId: session.user.id,
        action: "course.create",
        entityType: "course",
        entityId: newCourse.id,
      });

      return newCourse;
    });

    // Auto-syndicate course to Actualités news feed (Top #1 featured if published)
    if (course.published) {
      await syncCourseToActualites(course.id, { isFeatured: course.featured ?? true });
    }

    return NextResponse.json({ course }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
