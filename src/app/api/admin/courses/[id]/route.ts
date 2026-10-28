import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isSudoModeActive } from "@/server/auth/sudo";
import { db } from "@/server/db";
import {
  auditLogs,
  courses,
  enrollments,
  learningAssessment,
  learningQuestion,
  learningQuestionOption,
} from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import {
  syncCourseToActualites,
  deleteSyndicatedCourseNews,
} from "@/server/services/auto-news-syndication";
import { finalAssessmentInputSchema } from "../route";

const idSchema = z.string().uuid();
const patchSchema = z
  .object({
    published: z.boolean().optional(),
    featured: z.boolean().optional(),
    priceMillimes: z.number().int().nonnegative().max(100_000_000).optional(),
    titleFr: z.string().trim().min(3).max(180).optional(),
    titleAr: z.string().trim().min(3).max(180).optional(),
    summaryFr: z.string().trim().min(3).max(500).optional(),
    summaryAr: z.string().trim().min(3).max(500).optional(),
    descriptionFr: z.string().trim().min(3).max(10_000).optional(),
    descriptionAr: z.string().trim().min(3).max(10_000).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    trainerName: z.string().trim().min(2).max(120).optional(),
    durationMinutes: z.number().int().positive().max(100_000).optional(),
    level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    mode: z.enum(["online", "hybrid", "onsite"]).optional(),
    qualifiesForProfessionalPromotion: z.boolean().optional(),
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
      .strict()
      .optional(),
    finalAssessment: finalAssessmentInputSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required"
  );

async function validatedId(params: Promise<{ id: string }>) {
  return idSchema.safeParse((await params).id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const id = await validatedId(params);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const rawJson = await readLimitedJson(request).catch(() => null);
  const parsed = patchSchema.safeParse(rawJson);
  if (!parsed.success) {
    const isQcmIssue = parsed.error.issues.some((issue) =>
      issue.path.includes("finalAssessment")
    );
    if (isQcmIssue) {
      return NextResponse.json(
        {
          error: "ASSESSMENT_QCM_REQUIRED",
          message:
            "Le QCM d'évaluation finale fourni est incomplet ou invalide.",
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

  // If publishing course, ensure course has a valid assessment
  if (parsed.data.published === true && !parsed.data.finalAssessment) {
    const [existingAssessment] = await db
      .select({ id: learningAssessment.id })
      .from(learningAssessment)
      .where(eq(learningAssessment.courseId, id.data))
      .limit(1);

    if (existingAssessment) {
      const [{ value: questionCount }] = await db
        .select({ value: count() })
        .from(learningQuestion)
        .where(eq(learningQuestion.assessmentId, existingAssessment.id));

      if (questionCount === 0) {
        return NextResponse.json(
          {
            error: "ASSESSMENT_QCM_REQUIRED",
            message:
              "Chaque formation doit obligatoirement inclure un QCM d'évaluation finale chronométré avec au moins 1 question avant d'être publiée.",
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error: "ASSESSMENT_QCM_REQUIRED",
          message:
            "Chaque formation doit obligatoirement inclure un QCM d'évaluation finale chronométré avant d'être enregistrée ou publiée.",
        },
        { status: 400 }
      );
    }
  }

  const { coverImageObjectKey, finalAssessment, ...rest } = parsed.data;

  const course = await db.transaction(async (tx) => {
    const update = {
      ...rest,
      ...(coverImageObjectKey !== undefined
        ? { coverImage: coverImageObjectKey || null }
        : {}),
      updatedAt: new Date(),
    };

    const [updatedCourse] = await tx
      .update(courses)
      .set(update)
      .where(eq(courses.id, id.data))
      .returning();

    if (!updatedCourse) return null;

    // If final assessment payload is provided, upsert assessment and questions
    if (finalAssessment) {
      const [existingAssessment] = await tx
        .select({ id: learningAssessment.id })
        .from(learningAssessment)
        .where(eq(learningAssessment.courseId, id.data))
        .limit(1);

      let assessmentId: string;
      if (existingAssessment) {
        assessmentId = existingAssessment.id;
        await tx
          .update(learningAssessment)
          .set({
            timeLimitSeconds: finalAssessment.timeLimitMinutes * 60,
            passingScore: finalAssessment.passingScorePercent,
            revealAnswersAfterPass: finalAssessment.revealAnswersAfterPass,
            updatedAt: new Date(),
          })
          .where(eq(learningAssessment.id, assessmentId));

        // Replace questions
        await tx
          .delete(learningQuestion)
          .where(eq(learningQuestion.assessmentId, assessmentId));
      } else {
        const [createdAssessment] = await tx
          .insert(learningAssessment)
          .values({
            courseId: id.data,
            titleFr: `Évaluation Finale : ${updatedCourse.titleFr}`,
            titleAr: `التقييم النهائي: ${updatedCourse.titleAr}`,
            timeLimitSeconds: finalAssessment.timeLimitMinutes * 60,
            passingScore: finalAssessment.passingScorePercent,
            maxAttempts: 5,
            published: true,
            revealAnswersAfterPass: finalAssessment.revealAnswersAfterPass,
          })
          .returning();
        assessmentId = createdAssessment.id;
      }

      for (let i = 0; i < finalAssessment.questions.length; i++) {
        const q = finalAssessment.questions[i];
        const [question] = await tx
          .insert(learningQuestion)
          .values({
            assessmentId,
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
    }

    await tx.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "course.update",
      entityType: "course",
      entityId: id.data,
      metadata: parsed.data,
    });

    return updatedCourse;
  });

  if (!course) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Auto-sync syndicated actualités news post
  await syncCourseToActualites(course.id, {
    isFeatured: course.featured,
  });

  return NextResponse.json({ course });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const session = await getAdminSessionFor("courses.delete");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const sudoActive = await isSudoModeActive(request, session.user.id);
  if (!sudoActive) {
    return NextResponse.json(
      {
        error: "SUDO_REQUIRED",
        message:
          "Mode Sudo requis : veuillez confirmer votre mot de passe administrateur pour supprimer cette formation.",
      },
      { status: 403 }
    );
  }

  const id = await validatedId(params);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [{ value: enrollmentCount }] = await db
    .select({ value: count() })
    .from(enrollments)
    .where(eq(enrollments.courseId, id.data));

  if (enrollmentCount > 0) {
    const [course] = await db
      .update(courses)
      .set({ published: false, featured: false, updatedAt: new Date() })
      .where(eq(courses.id, id.data))
      .returning({ id: courses.id });
    if (!course) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await syncCourseToActualites(id.data, { isFeatured: false });
    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "course.archive",
      entityType: "course",
      entityId: id.data,
      metadata: { enrollmentCount },
    });
    return NextResponse.json({ ok: true, archived: true });
  }

  const [course] = await db
    .delete(courses)
    .where(eq(courses.id, id.data))
    .returning({ id: courses.id, slug: courses.slug });
  if (!course) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await deleteSyndicatedCourseNews(course.slug);
  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "course.delete",
    entityType: "course",
    entityId: id.data,
  });
  return NextResponse.json({ ok: true, archived: false });
}
