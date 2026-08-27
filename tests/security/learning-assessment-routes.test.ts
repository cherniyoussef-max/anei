import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

test("assessment authoring routes retain trusted-origin, rate-limit, and assessments.manage gates", () => {
  const routes = [
    "src/app/api/admin/learning-assessments/route.ts",
    "src/app/api/admin/learning-assessments/[id]/route.ts",
    "src/app/api/admin/learning-assessments/[id]/questions/route.ts",
    "src/app/api/admin/learning-assessments/[id]/questions/[questionId]/route.ts",
    "src/app/api/admin/learning-assessments/[id]/publication/route.ts",
  ];
  for (const route of routes) {
    const source = readFileSync(resolve(root, route), "utf8");
    assert.match(source, /isTrustedMutation\(request\)/, `${route} must enforce trusted origin`);
    assert.match(source, /getAdminSessionFor\("assessments\.manage"\)/, `${route} must require ADMIN or SUPER_ADMIN assessment permission`);
    assert.match(source, /adminMutationRateLimit/, `${route} must retain mutation rate limiting`);
  }
});

test("learner submission accepts identifiers only and remains strict", () => {
  const source = readFileSync(resolve(root, "src/app/api/learning/attempts/[id]/submit/route.ts"), "utf8");
  assert.match(source, /questionId: z\.string\(\)\.uuid\(\)/);
  assert.match(source, /optionIds: z\.array\(z\.string\(\)\.uuid\(\)\)/);
  assert.match(source, /\}\)\.strict\(\)/);
  assert.doesNotMatch(source, /score:|percentage:|passed:|isCorrect:/);
  assert.match(source, /isTrustedMutation\(request\)/);
  assert.match(source, /getSession\(\)/);
});
