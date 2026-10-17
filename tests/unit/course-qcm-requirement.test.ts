import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

const questionOptionSchema = z.object({
  textFr: z.string().trim().min(1, "Option text in French required").max(500),
  textAr: z.string().trim().min(1, "Option text in Arabic required").max(500),
});

const assessmentQuestionSchema = z.object({
  questionFr: z.string().trim().min(3, "Question in French required").max(1000),
  questionAr: z.string().trim().min(3, "Question in Arabic required").max(1000),
  points: z.number().int().min(1).default(1),
  explanationFr: z.string().trim().max(2000).optional(),
  explanationAr: z.string().trim().max(2000).optional(),
  options: z.array(questionOptionSchema).min(2, "At least 2 choices required").max(6),
  correctOptionIndex: z.number().int().min(0),
}).refine((q) => q.correctOptionIndex < q.options.length, {
  message: "correctOptionIndex must point to an existing option",
  path: ["correctOptionIndex"],
});

const finalAssessmentSchema = z.object({
  timeLimitMinutes: z.number().int().min(5).max(240).default(30),
  passingScorePercent: z.number().int().min(50).max(100).default(80),
  revealAnswersAfterPass: z.boolean().default(false),
  questions: z.array(assessmentQuestionSchema).min(1, "At least 1 final assessment question is mandatory"),
});

const courseCreateSchema = z.object({
  slug: z.string().min(3).max(120),
  titleFr: z.string().min(3).max(200),
  titleAr: z.string().min(3).max(200),
  finalAssessment: finalAssessmentSchema,
});

test("Course creation fails without mandatory finalAssessment QCM", () => {
  const invalidCourse = {
    slug: "formation-avs-inclusif",
    titleFr: "Formation AVS Inclusive",
    titleAr: "تكوين المرافق المدرسي الدامج",
  };

  const parsed = courseCreateSchema.safeParse(invalidCourse);
  assert.equal(parsed.success, false);
});

test("Course creation fails when finalAssessment has zero questions", () => {
  const invalidAssessment = {
    slug: "formation-avs-inclusif",
    titleFr: "Formation AVS Inclusive",
    titleAr: "تكوين المرافق المدرسي الدامج",
    finalAssessment: {
      timeLimitMinutes: 30,
      passingScorePercent: 80,
      revealAnswersAfterPass: false,
      questions: [],
    },
  };

  const parsed = courseCreateSchema.safeParse(invalidAssessment);
  assert.equal(parsed.success, false);
});

test("Course creation fails when correctOptionIndex is out of bounds", () => {
  const invalidOptionIndex = {
    slug: "formation-avs-inclusif",
    titleFr: "Formation AVS Inclusive",
    titleAr: "تكوين المرافق المدرسي الدامج",
    finalAssessment: {
      timeLimitMinutes: 30,
      passingScorePercent: 80,
      revealAnswersAfterPass: false,
      questions: [
        {
          questionFr: "Qu'est-ce que le PPS ?",
          questionAr: "ما هو مشروع الدمج الفردي؟",
          points: 1,
          options: [
            { textFr: "Projet Personnalisé de Scolarisation", textAr: "مشروع الدمج المدرسي الفردي" },
            { textFr: "Programme Pédagogique Standard", textAr: "برنامج بيداغوجي قياسي" },
          ],
          correctOptionIndex: 5, // Invalid: only 2 options (0, 1)
        },
      ],
    },
  };

  const parsed = courseCreateSchema.safeParse(invalidOptionIndex);
  assert.equal(parsed.success, false);
});

test("Course creation succeeds with compliant finalAssessment QCM", () => {
  const validCourse = {
    slug: "formation-avs-inclusif",
    titleFr: "Formation AVS Inclusive",
    titleAr: "تكوين المرافق المدرسي الدامج",
    finalAssessment: {
      timeLimitMinutes: 45,
      passingScorePercent: 85,
      revealAnswersAfterPass: true,
      questions: [
        {
          questionFr: "Quel est l'objectif premier d'un Projet Personnalisé de Scolarisation (PPS) ?",
          questionAr: "ما هو الهدف الأساسي من مشروع الدمج المدرسي الفردي (PPS)؟",
          points: 1,
          explanationFr: "Le PPS formalise les aménagements et adaptations pédagogiques.",
          explanationAr: "يحدد مشروع الدمج الفردي التعديلات البيداغوجية اللازمة.",
          options: [
            { textFr: "Définir les adaptations pédagogiques pour l'élève", textAr: "تحديد التعديلات التربوية اللازمة للمتعلم" },
            { textFr: "Isoler l'élève dans une classe spéciale", textAr: "عزل التلميذ في قسم خاص" },
          ],
          correctOptionIndex: 0,
        },
      ],
    },
  };

  const parsed = courseCreateSchema.safeParse(validCourse);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.finalAssessment.timeLimitMinutes, 45);
    assert.equal(parsed.data.finalAssessment.passingScorePercent, 85);
    assert.equal(parsed.data.finalAssessment.questions.length, 1);
    assert.equal(parsed.data.finalAssessment.questions[0].correctOptionIndex, 0);
  }
});
