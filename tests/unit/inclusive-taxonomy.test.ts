import test from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  ADAPTATIONS,
  SERVICE_TYPES,
  SELF_EVAL_QUESTIONS,
  COLOR_PALETTES,
  computeRecommendedAdaptations,
  getDifficultyColor,
  type DifficultyKey,
} from "@/lib/inclusive-taxonomy";

test("inclusive taxonomy: 6 core difficulties are defined with proper structure", () => {
  const keys: DifficultyKey[] = ["dys", "tdah", "vis", "aud", "tsa", "comp"];
  assert.equal(Object.keys(DIFFICULTIES).length, 6);

  for (const k of keys) {
    const diff = DIFFICULTIES[k];
    assert.ok(diff, `Difficulty ${k} must exist`);
    assert.ok(diff.labelFr, `Difficulty ${k} must have labelFr`);
    assert.ok(diff.labelAr, `Difficulty ${k} must have labelAr`);
    assert.ok(diff.defaultColor.startsWith("#"), `Difficulty ${k} must have valid hex color`);
    assert.ok(diff.recommendedAdaptations.length > 0, `Difficulty ${k} must have recommended adaptations`);
    assert.ok(diff.reflexTips.length > 0, `Difficulty ${k} must have reflex tips`);
    assert.ok(diff.resources.length > 0, `Difficulty ${k} must have pedagogical resources`);
  }
});

test("inclusive taxonomy: 11 adaptations are defined", () => {
  assert.equal(Object.keys(ADAPTATIONS).length, 11);
  const required = ["font", "big", "contrast", "tts", "simple", "steps", "pictos", "pauses", "time", "oral", "written"];
  for (const r of required) {
    assert.ok(ADAPTATIONS[r as keyof typeof ADAPTATIONS], `Adaptation ${r} must be defined`);
  }
});

test("inclusive taxonomy: computeRecommendedAdaptations aggregates and dedupes correctly", () => {
  // Empty array returns empty
  assert.deepEqual(computeRecommendedAdaptations([]), []);

  // Single difficulty
  const dysAdaptations = computeRecommendedAdaptations(["dys"]);
  assert.ok(dysAdaptations.includes("font"));
  assert.ok(dysAdaptations.includes("big"));
  assert.ok(dysAdaptations.includes("time"));

  // Combined difficulties without duplicates
  const combined = computeRecommendedAdaptations(["dys", "tdah"]);
  const uniqueSet = new Set(combined);
  assert.equal(combined.length, uniqueSet.size, "Computed adaptations must not have duplicates");
  assert.ok(combined.includes("font"));
  assert.ok(combined.includes("steps"));
  assert.ok(combined.includes("pauses"));
});

test("inclusive taxonomy: 3 color palettes exist and match 6 difficulties", () => {
  assert.equal(COLOR_PALETTES.Classique.length, 6);
  assert.equal(COLOR_PALETTES.Pastel.length, 6);
  assert.equal(COLOR_PALETTES.Daltonien.length, 6);

  // Daltonien palette must use colorblind-safe Okabe-Ito hex codes
  assert.equal(COLOR_PALETTES.Daltonien[0], "#0072B2");
});

test("inclusive taxonomy: getDifficultyColor resolves presets and custom colors correctly", () => {
  const defaultDysColor = getDifficultyColor("dys", "Classique");
  assert.equal(defaultDysColor, "#2563eb");

  const daltonienDysColor = getDifficultyColor("dys", "Daltonien");
  assert.equal(daltonienDysColor, "#0072B2");

  const customColor = getDifficultyColor("dys", "Personnalisée", { dys: "#ff00ff" });
  assert.equal(customColor, "#ff00ff");
});

test("inclusive taxonomy: 6 service types and 8 self-eval questions are mapped", () => {
  assert.equal(Object.keys(SERVICE_TYPES).length, 6);
  assert.equal(SELF_EVAL_QUESTIONS.length, 8);

  for (const q of SELF_EVAL_QUESTIONS) {
    assert.ok(q.questionFr);
    assert.ok(q.questionAr);
    assert.ok(SERVICE_TYPES[q.associatedService], `Service ${q.associatedService} must exist in catalog`);
  }
});
