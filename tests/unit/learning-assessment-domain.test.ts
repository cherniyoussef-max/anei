import test from "node:test";
import assert from "node:assert/strict";
import { validateLearningQuestion, type LearningQuestionInput } from "../../src/modules/learning/domain/assessment";

function question(overrides: Partial<LearningQuestionInput> = {}): LearningQuestionInput {
  return {
    promptFr: "Question en français",
    promptAr: "سؤال باللغة العربية",
    type: "SINGLE_CHOICE",
    position: 1,
    points: 1,
    options: [
      { textFr: "Réponse A", textAr: "الإجابة أ", position: 1, isCorrect: true },
      { textFr: "Réponse B", textAr: "الإجابة ب", position: 2, isCorrect: false },
      { textFr: "Réponse C", textAr: "الإجابة ج", position: 3, isCorrect: false },
    ],
    ...overrides,
  };
}

test("new SINGLE_CHOICE questions require at least three ordered options", () => {
  const input = question({ options: question().options.slice(0, 2) });
  assert.ok(validateLearningQuestion(input).includes("INVALID_OPTION_COUNT"));
  assert.equal(validateLearningQuestion(input, { allowLegacySingleChoice: true }).includes("INVALID_OPTION_COUNT"), false);
});

test("SINGLE_CHOICE requires exactly one correct answer", () => {
  const zeroCorrect = question({ options: question().options.map((option) => ({ ...option, isCorrect: false })) });
  const twoCorrect = question({ options: question().options.map((option, index) => ({ ...option, isCorrect: index < 2 })) });
  assert.ok(validateLearningQuestion(zeroCorrect).includes("INVALID_CORRECT_COUNT"));
  assert.ok(validateLearningQuestion(twoCorrect).includes("INVALID_CORRECT_COUNT"));
  assert.equal(validateLearningQuestion(question()).length, 0);
});

test("fourth and fifth ordered options are valid and positive points are required", () => {
  const options = [...question().options,
    { textFr: "Réponse D", textAr: "الإجابة د", position: 4, isCorrect: false },
    { textFr: "Réponse E", textAr: "الإجابة هـ", position: 5, isCorrect: false },
  ];
  assert.equal(validateLearningQuestion(question({ options })).length, 0);
  assert.ok(validateLearningQuestion(question({ options, points: 0 })).includes("INVALID_POINTS"));
  assert.ok(validateLearningQuestion(question({ options: options.map((option) => ({ ...option, position: 1 })) })).includes("DUPLICATE_POSITION"));
});
