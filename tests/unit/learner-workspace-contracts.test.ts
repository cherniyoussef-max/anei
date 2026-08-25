import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = ["formations", "rendez-vous", "ressources", "certificats", "profil"];

test("learner navigation uses real route URLs and route-aware aria-current, never dashboard hashes", async () => {
  const source = await readFile("src/components/student/StudentNavigation.tsx", "utf8");
  for (const route of routes) assert.equal(source.includes(`${'${base}'}/${route}`), true);
  assert.equal(source.includes("#courses"), false);
  assert.equal(source.includes("#sessions"), false);
  assert.equal(source.includes('aria-current={active ? "page" : undefined}'), true);
});

test("learner appointment mutations require origin, fresh session assurance, strict schemas, and caller ownership", async () => {
  for (const file of ["src/app/api/account/appointments/route.ts", "src/app/api/account/appointments/[id]/cancel/route.ts", "src/app/api/account/appointments/[id]/reschedule/route.ts"]) {
    const source = await readFile(file, "utf8");
    assert.equal(source.includes("isTrustedMutation(request)"), true, file);
    assert.equal(source.includes("getSessionAssurance(session.session.id)"), true, file);
  }
  const service = await readFile("src/server/services/learner-appointments.ts", "utf8");
  assert.equal(service.includes("eq(crmContact.linkedUserId, userId)"), true);
  assert.equal(service.includes("pg_advisory_xact_lock"), true);
  assert.equal(service.includes("MAX_WINDOW_DAYS = 42"), true);
});

test("learner profile update schema is strict and cannot accept privilege or verification fields", async () => {
  const source = await readFile("src/server/auth/profile.ts", "utf8");
  const start = source.indexOf("export const learnerProfileUpdateSchema");
  const end = source.indexOf("export async function updateLearnerProfile", start);
  const schema = source.slice(start, end);
  assert.equal(schema.includes(".strict()"), true);
  for (const forbidden of ["role", "organizationId", "phoneVerifiedAt", "requestedPersona", "onboardingCompletedAt"]) assert.equal(schema.includes(forbidden), false, forbidden);
});
