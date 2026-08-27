export const MAX_QUESTION_OPTIONS = 20;
export const MIN_NEW_SINGLE_CHOICE_OPTIONS = 3;

export type LearningQuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";

export type LearningQuestionInput = {
  promptFr: string;
  promptAr: string;
  type: LearningQuestionType;
  position: number;
  points: number;
  explanationFr?: string | null;
  explanationAr?: string | null;
  options: { textFr: string; textAr: string; position: number; isCorrect: boolean }[];
};

export type QuestionValidationCode =
  | "EMPTY_PROMPT"
  | "INVALID_POINTS"
  | "INVALID_OPTION_COUNT"
  | "EMPTY_OPTION"
  | "DUPLICATE_POSITION"
  | "INVALID_CORRECT_COUNT";

export function validateLearningQuestion(
  input: LearningQuestionInput,
  options: { allowLegacySingleChoice?: boolean } = {},
): QuestionValidationCode[] {
  const errors = new Set<QuestionValidationCode>();
  const correctCount = input.options.filter((option) => option.isCorrect).length;
  const minimumOptions = input.type === "TRUE_FALSE"
    ? 2
    : input.type === "SINGLE_CHOICE" && !options.allowLegacySingleChoice
      ? MIN_NEW_SINGLE_CHOICE_OPTIONS
      : 2;

  if (!input.promptFr.trim() || !input.promptAr.trim()) errors.add("EMPTY_PROMPT");
  if (!Number.isInteger(input.points) || input.points <= 0) errors.add("INVALID_POINTS");
  if (input.options.length < minimumOptions || input.options.length > MAX_QUESTION_OPTIONS) errors.add("INVALID_OPTION_COUNT");
  if (input.type === "TRUE_FALSE" && input.options.length !== 2) errors.add("INVALID_OPTION_COUNT");
  if (input.options.some((option) => !option.textFr.trim() || !option.textAr.trim())) errors.add("EMPTY_OPTION");
  if (new Set(input.options.map((option) => option.position)).size !== input.options.length) errors.add("DUPLICATE_POSITION");
  if (input.type === "MULTIPLE_CHOICE" ? correctCount < 1 : correctCount !== 1) errors.add("INVALID_CORRECT_COUNT");
  return [...errors];
}

export function isLearningQuestionValid(
  input: LearningQuestionInput,
  options?: { allowLegacySingleChoice?: boolean },
) {
  return validateLearningQuestion(input, options).length === 0;
}
