import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  courses,
  enrollments,
  learningAnswer,
  learningAssessment,
  learningAttempt,
  learningQuestion,
  learningQuestionOption,
} from "@/server/db/schema";
import { grantPoints, POINT_VALUES } from "@/server/services/points";

type QuestionInput = {
  promptFr: string;
  promptAr: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  position: number;
  points: number;
  explanationFr?: string | null;
  explanationAr?: string | null;
  options: { textFr: string; textAr: string; position: number; isCorrect: boolean }[];
};

export function validateQuestionCorrectness(input: QuestionInput) {
  const correct = input.options.filter((option) => option.isCorrect).length;
  if (input.options.length < 2 || input.options.length > 20) return false;
  if (new Set(input.options.map((option) => option.position)).size !== input.options.length) return false;
  if (input.type === "MULTIPLE_CHOICE") return correct >= 1;
  if (input.type === "TRUE_FALSE" && input.options.length !== 2) return false;
  return correct === 1;
}

export async function createLearningAssessment(actorUserId: string, input: {
  courseId: string; moduleId?: string | null; titleFr: string; titleAr: string;
  instructionsFr?: string; instructionsAr?: string; timeLimitSeconds: number;
  passingScore: number; maxAttempts: number;
}) {
  return db.transaction(async (tx) => {
    const [course] = await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, input.courseId)).limit(1);
    if (!course) return { kind: "course_not_found" as const };
    const [row] = await tx.insert(learningAssessment).values(input).returning();
    await tx.insert(auditLogs).values({ actorUserId, action: "learning_assessment.create", entityType: "learning_assessment", entityId: row.id, metadata: { courseId: row.courseId } });
    return { kind: "ok" as const, assessment: row };
  });
}

export async function addLearningQuestion(actorUserId: string, assessmentId: string, input: QuestionInput) {
  if (!validateQuestionCorrectness(input)) return { kind: "invalid_correctness" as const };
  return db.transaction(async (tx) => {
    const [assessment] = await tx.select({ id: learningAssessment.id, published: learningAssessment.published }).from(learningAssessment).where(eq(learningAssessment.id, assessmentId)).limit(1);
    if (!assessment) return { kind: "not_found" as const };
    if (assessment.published) return { kind: "published" as const };
    const { options, ...questionValues } = input;
    const [question] = await tx.insert(learningQuestion).values({ assessmentId, ...questionValues }).returning();
    await tx.insert(learningQuestionOption).values(options.map((option) => ({ questionId: question.id, ...option })));
    await tx.insert(auditLogs).values({ actorUserId, action: "learning_assessment.question.create", entityType: "learning_question", entityId: question.id, metadata: { assessmentId } });
    return { kind: "ok" as const, question };
  });
}

export async function deleteLearningQuestion(actorUserId: string, assessmentId: string, questionId: string) {
  return db.transaction(async (tx) => {
    const [question] = await tx.select({ id: learningQuestion.id, assessmentId: learningQuestion.assessmentId }).from(learningQuestion).where(and(eq(learningQuestion.id, questionId), eq(learningQuestion.assessmentId, assessmentId))).limit(1);
    if (!question) return { kind: "not_found" as const };
    const [assessment] = await tx.select({ published: learningAssessment.published }).from(learningAssessment).where(eq(learningAssessment.id, assessmentId)).limit(1);
    if (!assessment) return { kind: "not_found" as const };
    if (assessment.published) return { kind: "published" as const };
    await tx.delete(learningQuestion).where(eq(learningQuestion.id, questionId));
    await tx.insert(auditLogs).values({ actorUserId, action: "learning_assessment.question.delete", entityType: "learning_question", entityId: questionId, metadata: { assessmentId } });
    return { kind: "ok" as const };
  });
}

export async function deleteLearningAssessment(actorUserId: string, assessmentId: string) {
  return db.transaction(async (tx) => {
    const [assessment] = await tx.select({ id: learningAssessment.id }).from(learningAssessment).where(eq(learningAssessment.id, assessmentId)).limit(1);
    if (!assessment) return { kind: "not_found" as const };
    const [{ value: attemptCount }] = await tx.select({ value: count() }).from(learningAttempt).where(eq(learningAttempt.assessmentId, assessmentId));
    if (attemptCount > 0) {
      await tx.update(learningAssessment).set({ published: false, updatedAt: new Date() }).where(eq(learningAssessment.id, assessmentId));
      await tx.insert(auditLogs).values({ actorUserId, action: "learning_assessment.archive", entityType: "learning_assessment", entityId: assessmentId, metadata: { attemptCount } });
      return { kind: "ok" as const, archived: true };
    }
    await tx.delete(learningAssessment).where(eq(learningAssessment.id, assessmentId));
    await tx.insert(auditLogs).values({ actorUserId, action: "learning_assessment.delete", entityType: "learning_assessment", entityId: assessmentId });
    return { kind: "ok" as const, archived: false };
  });
}

export async function publishLearningAssessment(actorUserId: string, assessmentId: string, published: boolean) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${assessmentId}, 0))`);
    const [assessment] = await tx.select({ id: learningAssessment.id }).from(learningAssessment).where(eq(learningAssessment.id, assessmentId)).limit(1);
    if (!assessment) return { kind: "not_found" as const };
    if (published) {
      const questionRows = await tx.select({ id: learningQuestion.id }).from(learningQuestion).where(eq(learningQuestion.assessmentId, assessmentId));
      if (!questionRows.length) return { kind: "empty" as const };
      const optionRows = await tx.select().from(learningQuestionOption).where(inArray(learningQuestionOption.questionId, questionRows.map((row) => row.id)));
      for (const question of questionRows) {
        const options = optionRows.filter((option) => option.questionId === question.id);
        if (options.length < 2 || !options.some((option) => option.isCorrect)) return { kind: "invalid_question" as const };
      }
    }
    await tx.update(learningAssessment).set({ published, updatedAt: new Date() }).where(eq(learningAssessment.id, assessmentId));
    await tx.insert(auditLogs).values({ actorUserId, action: published ? "learning_assessment.publish" : "learning_assessment.unpublish", entityType: "learning_assessment", entityId: assessmentId });
    return { kind: "ok" as const };
  });
}

/** Learner projection deliberately excludes isCorrect and explanations. */
export async function getLearnerAssessment(userId: string, assessmentId: string) {
  const [row] = await db.select({
    assessment: {
      id: learningAssessment.id, courseId: learningAssessment.courseId, titleFr: learningAssessment.titleFr,
      titleAr: learningAssessment.titleAr, instructionsFr: learningAssessment.instructionsFr,
      instructionsAr: learningAssessment.instructionsAr, timeLimitSeconds: learningAssessment.timeLimitSeconds,
      passingScore: learningAssessment.passingScore, maxAttempts: learningAssessment.maxAttempts,
    },
    enrollmentId: enrollments.id,
  }).from(learningAssessment)
    .innerJoin(enrollments, and(eq(enrollments.courseId, learningAssessment.courseId), eq(enrollments.userId, userId)))
    .where(and(eq(learningAssessment.id, assessmentId), eq(learningAssessment.published, true)))
    .limit(1);
  if (!row) return null;
  const questions = await db.select({
    id: learningQuestion.id, promptFr: learningQuestion.promptFr, promptAr: learningQuestion.promptAr,
    type: learningQuestion.type, position: learningQuestion.position, points: learningQuestion.points,
  }).from(learningQuestion).where(eq(learningQuestion.assessmentId, assessmentId)).orderBy(asc(learningQuestion.position));
  const options = questions.length ? await db.select({
    id: learningQuestionOption.id, questionId: learningQuestionOption.questionId,
    textFr: learningQuestionOption.textFr, textAr: learningQuestionOption.textAr,
    position: learningQuestionOption.position,
  }).from(learningQuestionOption).where(inArray(learningQuestionOption.questionId, questions.map((question) => question.id))).orderBy(asc(learningQuestionOption.position)) : [];
  return { ...row, questions: questions.map((question) => ({ ...question, options: options.filter((option) => option.questionId === question.id) })) };
}

export async function startLearningAttempt(userId: string, assessmentId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${assessmentId}:${userId}`}, 0))`);
    const [context] = await tx.select({
      assessment: learningAssessment,
      enrollmentId: enrollments.id,
    }).from(learningAssessment)
      .innerJoin(enrollments, and(eq(enrollments.courseId, learningAssessment.courseId), eq(enrollments.userId, userId)))
      .where(and(eq(learningAssessment.id, assessmentId), eq(learningAssessment.published, true)))
      .limit(1);
    if (!context) return { kind: "forbidden" as const };
    const [active] = await tx.select().from(learningAttempt).where(and(eq(learningAttempt.assessmentId, assessmentId), eq(learningAttempt.userId, userId), eq(learningAttempt.status, "IN_PROGRESS"))).limit(1);
    if (active && active.expiresAt > new Date()) return { kind: "ok" as const, attempt: active, reused: true };
    if (active) await tx.update(learningAttempt).set({ status: "EXPIRED" }).where(eq(learningAttempt.id, active.id));
    const [aggregate] = await tx.select({ value: count() }).from(learningAttempt).where(and(eq(learningAttempt.assessmentId, assessmentId), eq(learningAttempt.userId, userId)));
    const attemptNumber = Number(aggregate?.value ?? 0) + 1;
    if (attemptNumber > context.assessment.maxAttempts) return { kind: "max_attempts" as const };
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + context.assessment.timeLimitSeconds * 1000);
    const [attempt] = await tx.insert(learningAttempt).values({ assessmentId, enrollmentId: context.enrollmentId, userId, attemptNumber, startedAt, expiresAt }).returning();
    return { kind: "ok" as const, attempt, reused: false };
  });
}

export async function submitLearningAttempt(userId: string, attemptId: string, answers: { questionId: string; optionIds: string[] }[]) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${attemptId}, 0))`);
    const [attempt] = await tx.select().from(learningAttempt).where(and(eq(learningAttempt.id, attemptId), eq(learningAttempt.userId, userId))).limit(1);
    if (!attempt) return { kind: "forbidden" as const };
    if (attempt.status === "GRADED" || attempt.status === "SUBMITTED") return { kind: "ok" as const, attempt, idempotent: true };
    if (attempt.status !== "IN_PROGRESS") return { kind: "invalid_state" as const };
    if (attempt.expiresAt.getTime() < Date.now()) {
      await tx.update(learningAttempt).set({ status: "EXPIRED" }).where(eq(learningAttempt.id, attempt.id));
      return { kind: "expired" as const };
    }
    const [assessment] = await tx.select().from(learningAssessment).where(eq(learningAssessment.id, attempt.assessmentId)).limit(1);
    if (!assessment) return { kind: "invalid_state" as const };
    const questions = await tx.select().from(learningQuestion).where(eq(learningQuestion.assessmentId, attempt.assessmentId));
    if (!questions.length || answers.length !== questions.length || new Set(answers.map((answer) => answer.questionId)).size !== answers.length) return { kind: "invalid_answers" as const };
    const questionIds = questions.map((question) => question.id);
    if (answers.some((answer) => !questionIds.includes(answer.questionId) || !answer.optionIds.length || new Set(answer.optionIds).size !== answer.optionIds.length)) return { kind: "invalid_answers" as const };
    const options = await tx.select().from(learningQuestionOption).where(inArray(learningQuestionOption.questionId, questionIds));
    let rawPoints = 0;
    const answerRows = [];
    for (const question of questions) {
      const answer = answers.find((item) => item.questionId === question.id)!;
      const allowed = options.filter((option) => option.questionId === question.id);
      if (answer.optionIds.some((optionId) => !allowed.some((option) => option.id === optionId))) return { kind: "invalid_answers" as const };
      if (question.type !== "MULTIPLE_CHOICE" && answer.optionIds.length !== 1) return { kind: "invalid_answers" as const };
      const selected = [...answer.optionIds].sort();
      const correct = allowed.filter((option) => option.isCorrect).map((option) => option.id).sort();
      const pointsAwarded = selected.length === correct.length && selected.every((id, index) => id === correct[index]) ? question.points : 0;
      rawPoints += pointsAwarded;
      answerRows.push({ attemptId, questionId: question.id, selectedOptionIds: selected, pointsAwarded });
    }
    const maxPoints = questions.reduce((total, question) => total + question.points, 0);
    if (maxPoints <= 0) return { kind: "invalid_state" as const };
    const percentage = Math.round((rawPoints / maxPoints) * 100);
    const submittedAt = new Date();
    await tx.insert(learningAnswer).values(answerRows);
    const passed = percentage >= assessment.passingScore;
    const [graded] = await tx.update(learningAttempt).set({ status: "GRADED", submittedAt, rawPoints, maxPoints, percentage, passed }).where(eq(learningAttempt.id, attemptId)).returning();
    if (passed) {
      await grantPoints(tx, { userId, reason: "QUIZ_PASSED", delta: POINT_VALUES.QUIZ_PASSED, referenceType: "learning_attempt", referenceId: attemptId });
    }
    return { kind: "ok" as const, attempt: graded, idempotent: false };
  });
}

export async function getAdminAssessmentResults(limit = 50) {
  return db.select({
    attempt: learningAttempt,
    assessment: { id: learningAssessment.id, titleFr: learningAssessment.titleFr, titleAr: learningAssessment.titleAr },
    course: { id: courses.id, titleFr: courses.titleFr, titleAr: courses.titleAr },
  }).from(learningAttempt)
    .innerJoin(learningAssessment, eq(learningAttempt.assessmentId, learningAssessment.id))
    .innerJoin(courses, eq(learningAssessment.courseId, courses.id))
    .where(eq(learningAttempt.status, "GRADED"))
    .orderBy(desc(learningAttempt.submittedAt)).limit(Math.min(100, Math.max(1, limit)));
}
