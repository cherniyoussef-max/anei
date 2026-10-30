import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  lessonQuizQuestions,
  learnerQuizAttempts,
  lessonFlashcards,
  learnerFlashcardReviews,
} from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const quizAttemptSchema = z.object({
  lessonId: z.string().min(1),
  responses: z.record(z.string(), z.array(z.string())),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rate = await consumeRateLimit(`quiz-attempt:${session.user.id}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = quizAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.issues }, { status: 400 });
  }

  const { lessonId, responses } = parsed.data;

  // Fetch all questions for this lesson
  const questions = await db
    .select({
      id: lessonQuizQuestions.id,
      correctOptionIds: lessonQuizQuestions.correctOptionIds,
      explanationFr: lessonQuizQuestions.explanationFr,
      explanationAr: lessonQuizQuestions.explanationAr,
      position: lessonQuizQuestions.position,
    })
    .from(lessonQuizQuestions)
    .where(eq(lessonQuizQuestions.lessonId, lessonId))
    .orderBy(asc(lessonQuizQuestions.position));

  if (!questions.length) {
    return NextResponse.json({ error: "NO_QUESTIONS_FOUND" }, { status: 404 });
  }

  let correctCount = 0;
  const missedQuestionIds: string[] = [];
  const questionResults: Record<
    string,
    { isCorrect: boolean; correctOptionIds: string[]; explanationFr: string; explanationAr: string }
  > = {};

  const structuredAnswers: Array<{ questionId: string; selectedOptionIds: string[]; correct: boolean }> = [];

  for (const q of questions) {
    const userSelected = responses[q.id] ?? [];
    const correctIds = q.correctOptionIds ?? [];

    const isMatch =
      userSelected.length === correctIds.length &&
      userSelected.every((id) => correctIds.includes(id));

    if (isMatch) {
      correctCount += 1;
    } else {
      missedQuestionIds.push(q.id);
    }

    structuredAnswers.push({
      questionId: q.id,
      selectedOptionIds: userSelected,
      correct: isMatch,
    });

    questionResults[q.id] = {
      isCorrect: isMatch,
      correctOptionIds: correctIds,
      explanationFr: q.explanationFr,
      explanationAr: q.explanationAr,
    };
  }

  const totalQuestions = questions.length;
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
  const passed = scorePercentage >= 80;

  // Insert quiz attempt record
  const attemptId = crypto.randomUUID();
  await db.insert(learnerQuizAttempts).values({
    id: attemptId,
    userId: session.user.id,
    lessonId,
    scorePercentage,
    passed,
    answers: structuredAnswers,
    completedAt: new Date(),
  });

  // If learner missed questions, auto-queue related flashcards for spaced repetition
  let addedToReviewQueueCount = 0;
  if (missedQuestionIds.length > 0) {
    const flashcards = await db
      .select({ id: lessonFlashcards.id })
      .from(lessonFlashcards)
      .where(eq(lessonFlashcards.lessonId, lessonId));

    if (flashcards.length > 0) {
      const existingReviews = await db
        .select({ cardId: learnerFlashcardReviews.cardId })
        .from(learnerFlashcardReviews)
        .where(
          and(
            eq(learnerFlashcardReviews.userId, session.user.id),
            inArray(
              learnerFlashcardReviews.cardId,
              flashcards.map((f) => f.id)
            )
          )
        );

      const existingSet = new Set(existingReviews.map((r) => r.cardId));
      const cardsToSchedule = flashcards.filter((f) => !existingSet.has(f.id));

      if (cardsToSchedule.length > 0) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        await db.insert(learnerFlashcardReviews).values(
          cardsToSchedule.map((c) => ({
            id: crypto.randomUUID(),
            userId: session.user.id,
            cardId: c.id,
            easeFactor: 2.5,
            intervalDays: 1,
            repetitionCount: 0,
            nextReviewDate: tomorrow,
            lastReviewedAt: null,
            lastGrade: null,
          }))
        );
        addedToReviewQueueCount = cardsToSchedule.length;
      }
    }
  }

  return NextResponse.json({
    attemptId,
    scorePercentage,
    passed,
    correctCount,
    totalQuestions,
    questionResults,
    addedToReviewQueueCount,
  });
}
