import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  lessonChapters,
  lessonTranscripts,
  lessonTakeaways,
  lessonPersonalNotes,
  lessonFlashcards,
  learnerFlashcardReviews,
  lessonPracticeActions,
  learnerPracticeLogs,
  lessonQuizQuestions,
  learnerQuizAttempts,
  lessons,
  courses,
} from "@/server/db/schema";

export type LessonLearningData = {
  chapters: Array<{
    id: string;
    titleFr: string;
    titleAr: string;
    startSeconds: number;
    position: number;
  }>;
  transcript: {
    language: string;
    cues: Array<{ start: number; end: number; text: string }>;
  } | null;
  takeaways: Array<{
    id: string;
    titleFr: string;
    titleAr: string;
    summaryFr: string;
    summaryAr: string;
    timestampSeconds: number;
    position: number;
    isDraft: boolean;
  }>;
  notes: Array<{
    id: string;
    timestampSeconds: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  flashcards: Array<{
    id: string;
    conceptFr: string;
    conceptAr: string;
    definitionFr: string;
    definitionAr: string;
    contextScenarioFr: string | null;
    contextScenarioAr: string | null;
    position: number;
  }>;
  practiceAction: {
    id: string;
    titleFr: string;
    titleAr: string;
    instructionsFr: string;
    instructionsAr: string;
    triedIt: boolean;
    reflectionNote: string | null;
  } | null;
  quizQuestions: Array<{
    id: string;
    promptFr: string;
    promptAr: string;
    type: string;
    options: Array<{ id: string; textFr: string; textAr: string }>;
    correctOptionIds: string[];
    explanationFr: string;
    explanationAr: string;
    timestampSeconds: number | null;
    position: number;
  }>;
  bestQuizAttempt: {
    id: string;
    scorePercentage: number;
    passed: boolean;
    completedAt: Date;
  } | null;
};

export async function getLessonLearningData(
  lessonId: string,
  userId: string,
  locale: string = "fr"
): Promise<LessonLearningData> {
  const preferredLang = locale === "ar" ? "ar" : locale === "en" ? "en" : "fr";

  const [
    chapters,
    transcripts,
    takeaways,
    notes,
    flashcards,
    practiceActions,
    practiceLogs,
    quizQuestions,
    quizAttempts,
  ] = await Promise.all([
    // 1. Chapters
    db
      .select({
        id: lessonChapters.id,
        titleFr: lessonChapters.titleFr,
        titleAr: lessonChapters.titleAr,
        startSeconds: lessonChapters.startSeconds,
        position: lessonChapters.position,
      })
      .from(lessonChapters)
      .where(eq(lessonChapters.lessonId, lessonId))
      .orderBy(asc(lessonChapters.position), asc(lessonChapters.startSeconds)),

    // 2. Transcripts
    db
      .select({
        language: lessonTranscripts.language,
        cues: lessonTranscripts.cues,
      })
      .from(lessonTranscripts)
      .where(eq(lessonTranscripts.lessonId, lessonId)),

    // 3. Takeaways
    db
      .select({
        id: lessonTakeaways.id,
        titleFr: lessonTakeaways.titleFr,
        titleAr: lessonTakeaways.titleAr,
        summaryFr: lessonTakeaways.summaryFr,
        summaryAr: lessonTakeaways.summaryAr,
        timestampSeconds: lessonTakeaways.timestampSeconds,
        position: lessonTakeaways.position,
        isDraft: lessonTakeaways.isDraft,
      })
      .from(lessonTakeaways)
      .where(eq(lessonTakeaways.lessonId, lessonId))
      .orderBy(asc(lessonTakeaways.position)),

    // 4. Notes
    db
      .select({
        id: lessonPersonalNotes.id,
        timestampSeconds: lessonPersonalNotes.timestampSeconds,
        content: lessonPersonalNotes.content,
        createdAt: lessonPersonalNotes.createdAt,
        updatedAt: lessonPersonalNotes.updatedAt,
      })
      .from(lessonPersonalNotes)
      .where(
        and(
          eq(lessonPersonalNotes.lessonId, lessonId),
          eq(lessonPersonalNotes.userId, userId)
        )
      )
      .orderBy(asc(lessonPersonalNotes.timestampSeconds), asc(lessonPersonalNotes.createdAt)),

    // 5. Flashcards
    db
      .select({
        id: lessonFlashcards.id,
        conceptFr: lessonFlashcards.conceptFr,
        conceptAr: lessonFlashcards.conceptAr,
        definitionFr: lessonFlashcards.definitionFr,
        definitionAr: lessonFlashcards.definitionAr,
        contextScenarioFr: lessonFlashcards.contextScenarioFr,
        contextScenarioAr: lessonFlashcards.contextScenarioAr,
        position: lessonFlashcards.position,
      })
      .from(lessonFlashcards)
      .where(eq(lessonFlashcards.lessonId, lessonId))
      .orderBy(asc(lessonFlashcards.position)),

    // 6. Practice Actions
    db
      .select()
      .from(lessonPracticeActions)
      .where(eq(lessonPracticeActions.lessonId, lessonId))
      .limit(1),

    // 7. Practice Logs
    db
      .select()
      .from(learnerPracticeLogs)
      .where(eq(learnerPracticeLogs.userId, userId)),

    // 8. Quiz Questions
    db
      .select({
        id: lessonQuizQuestions.id,
        promptFr: lessonQuizQuestions.promptFr,
        promptAr: lessonQuizQuestions.promptAr,
        type: lessonQuizQuestions.type,
        options: lessonQuizQuestions.options,
        correctOptionIds: lessonQuizQuestions.correctOptionIds,
        explanationFr: lessonQuizQuestions.explanationFr,
        explanationAr: lessonQuizQuestions.explanationAr,
        timestampSeconds: lessonQuizQuestions.timestampSeconds,
        position: lessonQuizQuestions.position,
      })
      .from(lessonQuizQuestions)
      .where(eq(lessonQuizQuestions.lessonId, lessonId))
      .orderBy(asc(lessonQuizQuestions.position)),

    // 9. Best Quiz Attempt
    db
      .select({
        id: learnerQuizAttempts.id,
        scorePercentage: learnerQuizAttempts.scorePercentage,
        passed: learnerQuizAttempts.passed,
        completedAt: learnerQuizAttempts.completedAt,
      })
      .from(learnerQuizAttempts)
      .where(
        and(
          eq(learnerQuizAttempts.lessonId, lessonId),
          eq(learnerQuizAttempts.userId, userId)
        )
      )
      .orderBy(desc(learnerQuizAttempts.scorePercentage), desc(learnerQuizAttempts.completedAt))
      .limit(1),
  ]);

  // Resolve best transcript matching locale or fallback
  const exactTranscript = transcripts.find((t) => t.language === preferredLang);
  const fallbackTranscript = transcripts.find((t) => t.language === "fr") || transcripts[0] || null;
  const transcript = exactTranscript || fallbackTranscript;

  // Resolve practice action with learner's log
  const action = practiceActions[0] || null;
  let practiceAction: LessonLearningData["practiceAction"] = null;
  if (action) {
    const userLog = practiceLogs.find((log) => log.practiceActionId === action.id);
    practiceAction = {
      id: action.id,
      titleFr: action.titleFr,
      titleAr: action.titleAr,
      instructionsFr: action.instructionsFr,
      instructionsAr: action.instructionsAr,
      triedIt: userLog?.triedIt ?? false,
      reflectionNote: userLog?.reflectionNote ?? null,
    };
  }

  return {
    chapters,
    transcript: transcript
      ? {
          language: transcript.language,
          cues: transcript.cues as Array<{ start: number; end: number; text: string }>,
        }
      : null,
    takeaways,
    notes,
    flashcards,
    practiceAction,
    quizQuestions,
    bestQuizAttempt: quizAttempts[0] || null,
  };
}

export async function getLearnerNotes(userId: string) {
  return db
    .select({
      noteId: lessonPersonalNotes.id,
      timestampSeconds: lessonPersonalNotes.timestampSeconds,
      content: lessonPersonalNotes.content,
      createdAt: lessonPersonalNotes.createdAt,
      lessonId: lessons.id,
      lessonTitleFr: lessons.titleFr,
      lessonTitleAr: lessons.titleAr,
      courseSlug: courses.slug,
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
    })
    .from(lessonPersonalNotes)
    .innerJoin(lessons, eq(lessonPersonalNotes.lessonId, lessons.id))
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(eq(lessonPersonalNotes.userId, userId))
    .orderBy(desc(lessonPersonalNotes.createdAt));
}

export type ReviewCardItem = {
  reviewId: string | null;
  cardId: string;
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  conceptFr: string;
  conceptAr: string;
  definitionFr: string;
  definitionAr: string;
  contextScenarioFr: string | null;
  contextScenarioAr: string | null;
  lessonTitleFr: string;
  lessonTitleAr: string;
  courseSlug: string;
};

export async function getLearnerDailyReviewSummary(userId: string) {
  const now = new Date();
  
  // Cards already scheduled and due
  const dueReviews = await db
    .select({
      reviewId: learnerFlashcardReviews.id,
      cardId: learnerFlashcardReviews.cardId,
      easeFactor: learnerFlashcardReviews.easeFactor,
      intervalDays: learnerFlashcardReviews.intervalDays,
      repetitionCount: learnerFlashcardReviews.repetitionCount,
      conceptFr: lessonFlashcards.conceptFr,
      conceptAr: lessonFlashcards.conceptAr,
      definitionFr: lessonFlashcards.definitionFr,
      definitionAr: lessonFlashcards.definitionAr,
      contextScenarioFr: lessonFlashcards.contextScenarioFr,
      contextScenarioAr: lessonFlashcards.contextScenarioAr,
      lessonTitleFr: lessons.titleFr,
      lessonTitleAr: lessons.titleAr,
      courseSlug: courses.slug,
    })
    .from(learnerFlashcardReviews)
    .innerJoin(lessonFlashcards, eq(learnerFlashcardReviews.cardId, lessonFlashcards.id))
    .innerJoin(lessons, eq(lessonFlashcards.lessonId, lessons.id))
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(
      and(
        eq(learnerFlashcardReviews.userId, userId),
        sql`${learnerFlashcardReviews.nextReviewDate} <= ${now}`
      )
    )
    .limit(10); // Batch cap: max 10 cards per daily session

  let dueCards: ReviewCardItem[] = dueReviews.map((r) => ({
    ...r,
    reviewId: r.reviewId,
  }));

  // New cards from completed or in-progress lessons not yet in the review queue
  if (dueCards.length < 10) {
    const existingCardIds = new Set(
      (
        await db
          .select({ cardId: learnerFlashcardReviews.cardId })
          .from(learnerFlashcardReviews)
          .where(eq(learnerFlashcardReviews.userId, userId))
      ).map((r) => r.cardId)
    );

    const newCards = await db
      .select({
        cardId: lessonFlashcards.id,
        conceptFr: lessonFlashcards.conceptFr,
        conceptAr: lessonFlashcards.conceptAr,
        definitionFr: lessonFlashcards.definitionFr,
        definitionAr: lessonFlashcards.definitionAr,
        contextScenarioFr: lessonFlashcards.contextScenarioFr,
        contextScenarioAr: lessonFlashcards.contextScenarioAr,
        lessonTitleFr: lessons.titleFr,
        lessonTitleAr: lessons.titleAr,
        courseSlug: courses.slug,
      })
      .from(lessonFlashcards)
      .innerJoin(lessons, eq(lessonFlashcards.lessonId, lessons.id))
      .innerJoin(courses, eq(lessons.courseId, courses.id))
      .limit(10 - dueCards.length);

    const eligibleNewCards: ReviewCardItem[] = newCards
      .filter((c) => !existingCardIds.has(c.cardId))
      .map((c) => ({
        ...c,
        reviewId: null,
        easeFactor: 2.5,
        intervalDays: 0,
        repetitionCount: 0,
      }));

    dueCards = [...dueCards, ...eligibleNewCards];
  }

  const count = dueCards.length;
  const estimatedMinutes = Math.max(1, Math.ceil(count * 0.5));

  return {
    dueCount: count,
    estimatedMinutes,
    cards: dueCards,
  };
}

export function calculateSm2Review(
  grade: number,
  repetitionCount: number,
  easeFactor: number = 2.5,
  intervalDays: number = 0
): {
  repetitionCount: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewDate: Date;
} {
  const q = Math.max(0, Math.min(4, Math.round(grade)));
  let newEf = easeFactor + (0.1 - (4 - q) * (0.08 + (4 - q) * 0.02));
  if (newEf < 1.3) newEf = 1.3;

  let newRepetitions = repetitionCount;
  let newInterval = intervalDays;

  if (q < 2) {
    newRepetitions = 0;
    newInterval = 1;
  } else {
    if (newRepetitions === 0) {
      newInterval = 1;
    } else if (newRepetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.max(1, Math.round(newInterval * newEf));
    }
    newRepetitions += 1;
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    repetitionCount: newRepetitions,
    easeFactor: Math.round(newEf * 100) / 100,
    intervalDays: newInterval,
    nextReviewDate,
  };
}
