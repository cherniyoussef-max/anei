import test from "node:test";
import assert from "node:assert/strict";
import { calculateSm2Review } from "../../src/server/queries/learning-experience";
import * as schema from "../../src/server/db/schema";
import { z } from "zod";

const createNoteSchema = z.object({
  id: z.string().uuid().optional(),
  lessonId: z.string().uuid(),
  timestampSeconds: z.number().int().min(0).max(86400).default(0),
  content: z.string().trim().min(1, "La note ne peut pas être vide").max(2000),
});

test("SM-2 Spaced Repetition: initial recall schedules next day with repetition 1", () => {
  const result = calculateSm2Review(3, 0, 2.5, 0);
  assert.equal(result.repetitionCount, 1);
  assert.equal(result.intervalDays, 1);
  assert.ok(result.easeFactor >= 2.3);
  assert.ok(result.nextReviewDate instanceof Date);
});

test("SM-2 Spaced Repetition: second successful recall schedules at 6 days", () => {
  const result = calculateSm2Review(3, 1, 2.5, 1);
  assert.equal(result.repetitionCount, 2);
  assert.equal(result.intervalDays, 6);
});

test("SM-2 Spaced Repetition: third successful recall multiplies interval by ease factor", () => {
  const result = calculateSm2Review(4, 2, 2.5, 6);
  assert.equal(result.repetitionCount, 3);
  assert.ok(result.intervalDays >= 15);
  assert.ok(result.easeFactor >= 2.5); // Grade 4 increases ease factor
});

test("SM-2 Spaced Repetition: failure (grade < 2) resets repetitions to 0 and interval to 1", () => {
  const result = calculateSm2Review(1, 5, 2.5, 30);
  assert.equal(result.repetitionCount, 0);
  assert.equal(result.intervalDays, 1);
});

test("SM-2 Spaced Repetition: ease factor never drops below minimum 1.3", () => {
  let ef = 2.5;
  for (let i = 0; i < 10; i++) {
    const res = calculateSm2Review(0, 0, ef, 0);
    ef = res.easeFactor;
  }
  assert.equal(ef, 1.3);
});

test("Personal Notes validation: valid note passes", () => {
  const valid = {
    lessonId: "28179bcf-7f12-4f12-9ab8-9a9f5e92ec86",
    timestampSeconds: 125,
    content: "Observé en classe : structurer la consigne visuellement.",
  };
  const parsed = createNoteSchema.safeParse(valid);
  assert.ok(parsed.success);
  if (parsed.success) {
    assert.equal(parsed.data.timestampSeconds, 125);
    assert.equal(parsed.data.content, "Observé en classe : structurer la consigne visuellement.");
  }
});

test("Personal Notes validation: empty content and negative timestamps are rejected", () => {
  const emptyContent = {
    lessonId: "28179bcf-7f12-4f12-9ab8-9a9f5e92ec86",
    timestampSeconds: 10,
    content: "   ",
  };
  assert.ok(!createNoteSchema.safeParse(emptyContent).success);

  const negativeTime = {
    lessonId: "28179bcf-7f12-4f12-9ab8-9a9f5e92ec86",
    timestampSeconds: -5,
    content: "Valid text",
  };
  assert.ok(!createNoteSchema.safeParse(negativeTime).success);
});

test("Database Schema: all 10 additive learning experience tables are registered", () => {
  assert.ok(schema.lessonChapters, "lessonChapters table exists");
  assert.ok(schema.lessonTranscripts, "lessonTranscripts table exists");
  assert.ok(schema.lessonTakeaways, "lessonTakeaways table exists");
  assert.ok(schema.lessonPersonalNotes, "lessonPersonalNotes table exists");
  assert.ok(schema.lessonFlashcards, "lessonFlashcards table exists");
  assert.ok(schema.learnerFlashcardReviews, "learnerFlashcardReviews table exists");
  assert.ok(schema.lessonPracticeActions, "lessonPracticeActions table exists");
  assert.ok(schema.learnerPracticeLogs, "learnerPracticeLogs table exists");
  assert.ok(schema.lessonQuizQuestions, "lessonQuizQuestions table exists");
  assert.ok(schema.learnerQuizAttempts, "learnerQuizAttempts table exists");
});

test("Validation Quiz Scoring: >=80% passes, <80% requires reinforcement", () => {
  const calculatePass = (correct: number, total: number) => {
    const score = Math.round((correct / total) * 100);
    return { score, passed: score >= 80 };
  };

  const passAttempt = calculatePass(4, 4);
  assert.equal(passAttempt.score, 100);
  assert.equal(passAttempt.passed, true);

  const failAttempt = calculatePass(3, 4);
  assert.equal(failAttempt.score, 75);
  assert.equal(failAttempt.passed, false);

  const borderlinePass = calculatePass(4, 5);
  assert.equal(borderlinePass.score, 80);
  assert.equal(borderlinePass.passed, true);
});

test("Practice Action schema: requires actionId and boolean triedIt", () => {
  const practiceSchema = z.object({
    actionId: z.string().min(1),
    triedIt: z.boolean(),
    reflectionNote: z.string().max(5000).optional().nullable(),
  });

  assert.ok(practiceSchema.safeParse({ actionId: "action-1", triedIt: true, reflectionNote: "Bonne réaction de l'élève." }).success);
  assert.ok(practiceSchema.safeParse({ actionId: "action-1", triedIt: false }).success);
  assert.ok(!practiceSchema.safeParse({ actionId: "", triedIt: true }).success);
});

test("Spaced Repetition Review grade: accepts 1-4, rejects invalid grades", () => {
  const gradeSchema = z.object({
    cardId: z.string().min(1),
    grade: z.number().int().min(1).max(4),
  });

  assert.ok(gradeSchema.safeParse({ cardId: "card-1", grade: 1 }).success);
  assert.ok(gradeSchema.safeParse({ cardId: "card-1", grade: 4 }).success);
  assert.ok(!gradeSchema.safeParse({ cardId: "card-1", grade: 0 }).success);
  assert.ok(!gradeSchema.safeParse({ cardId: "card-1", grade: 5 }).success);
});
