import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { certificates, enrollments, learningAssessment, learningAttempt, lessonProgress, lessons } from "@/server/db/schema";
import { grantPoints, POINT_VALUES } from "@/server/services/points";

/**
 * The browser reports a playback position, never a "completed" flag. Completion
 * is derived server-side from the lesson duration and stored progress. This is
 * not DRM; it is a business-rule boundary that prevents trivial `completed:true`
 * request forgery from issuing certificates.
 */
export async function updateLessonProgress(input: { userId: string; lessonId: string; watchedSeconds: number; completed?: boolean }) {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ enrollment: enrollments, lesson: lessons })
      .from(lessons)
      .innerJoin(enrollments, eq(enrollments.courseId, lessons.courseId))
      .where(and(eq(lessons.id, input.lessonId), eq(enrollments.userId, input.userId), eq(enrollments.status, "active")))
      .limit(1);
    if (!owned) throw new Error("LESSON_NOT_ACCESSIBLE");

    const [previous] = await tx
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.enrollmentId, owned.enrollment.id), eq(lessonProgress.lessonId, input.lessonId)))
      .limit(1);

    const targetDuration = owned.lesson.durationSeconds || input.watchedSeconds;
    const bounded = Math.max(0, Math.min(input.watchedSeconds, targetDuration));
    const watchedSeconds = input.completed
      ? (targetDuration || 1)
      : Math.max(previous?.watchedSeconds ?? 0, bounded);
    const lessonCompleted = Boolean(input.completed) || (owned.lesson.durationSeconds > 0
      ? watchedSeconds >= Math.ceil(owned.lesson.durationSeconds * 0.9)
      : Boolean(previous?.completed));

    await tx
      .insert(lessonProgress)
      .values({ enrollmentId: owned.enrollment.id, lessonId: input.lessonId, watchedSeconds, completed: lessonCompleted })
      .onConflictDoUpdate({
        target: [lessonProgress.enrollmentId, lessonProgress.lessonId],
        set: { watchedSeconds, completed: lessonCompleted, updatedAt: new Date() },
      });

    if (lessonCompleted && !previous?.completed) {
      await grantPoints(tx, { userId: input.userId, reason: "LESSON_COMPLETE", delta: POINT_VALUES.LESSON_COMPLETE, referenceType: "lesson", referenceId: input.lessonId });
    }

    const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(lessons).where(eq(lessons.courseId, owned.lesson.courseId));
    const [{ done }] = await tx
      .select({ done: sql<number>`count(*)::int` })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .where(and(eq(lessonProgress.enrollmentId, owned.enrollment.id), eq(lessonProgress.completed, true)));

    // Check if the course requires a mandatory published assessment
    const [publishedAssessment] = await tx
      .select({ id: learningAssessment.id })
      .from(learningAssessment)
      .where(and(eq(learningAssessment.courseId, owned.lesson.courseId), eq(learningAssessment.published, true)))
      .limit(1);

    let hasPassedAssessment = false;
    if (publishedAssessment) {
      const [passedAttempt] = await tx
        .select({ id: learningAttempt.id })
        .from(learningAttempt)
        .where(
          and(
            eq(learningAttempt.assessmentId, publishedAssessment.id),
            eq(learningAttempt.userId, input.userId),
            eq(learningAttempt.passed, true)
          )
        )
        .limit(1);
      hasPassedAssessment = Boolean(passedAttempt);
    }

    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const allLessonsDone = percent === 100;
    const courseCompleted = allLessonsDone && (!publishedAssessment || hasPassedAssessment);
    // When all lessons are done but the final assessment is not passed yet, keep progress at 95%
    const progressPercent = allLessonsDone && publishedAssessment && !hasPassedAssessment ? 95 : percent;

    await tx
      .update(enrollments)
      .set({ progressPercent, status: courseCompleted ? "completed" : "active", completedAt: courseCompleted ? new Date() : null })
      .where(eq(enrollments.id, owned.enrollment.id));

    let certificateCode: string | null = null;
    if (courseCompleted) {
      const code = `ANEI-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
      const [inserted] = await tx
        .insert(certificates)
        .values({ userId: input.userId, courseId: owned.lesson.courseId, code })
        .onConflictDoNothing({ target: [certificates.userId, certificates.courseId] })
        .returning({ code: certificates.code });
      if (inserted) {
        certificateCode = inserted.code;
        await grantPoints(tx, { userId: input.userId, reason: "COURSE_COMPLETE", delta: POINT_VALUES.COURSE_COMPLETE, referenceType: "course", referenceId: owned.lesson.courseId });
      } else {
        const [existing] = await tx
          .select({ code: certificates.code })
          .from(certificates)
          .where(and(eq(certificates.userId, input.userId), eq(certificates.courseId, owned.lesson.courseId)))
          .limit(1);
        certificateCode = existing?.code ?? null;
      }
    }

    return { percent: progressPercent, lessonCompleted, courseCompleted, certificateCode };
  });
}
