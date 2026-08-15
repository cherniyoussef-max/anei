import test from "node:test";
import assert from "node:assert/strict";
import {
  personas,
  personaStatuses,
  isPersona,
  isProfessionalPersona,
  defaultStatusFor,
  legacyPersonaFromProfileType,
  parseRegistrationProfileType,
  profileTypeToPersona,
  personaPortalPath,
} from "../../src/modules/personas/domain/permissions";

test("isPersona accepts only the six canonical values", () => {
  for (const persona of personas) assert.equal(isPersona(persona), true);
  for (const bogus of ["Teacher", "teacher", "ADMIN", "SUPER_ADMIN", "PARENT_ADMIN", "", "STUDENT ", "<script>"]) {
    assert.equal(isPersona(bogus), false, `expected "${bogus}" to be rejected`);
  }
});

test("personas/personaStatuses never overlap with Better Auth security roles", () => {
  const roles = ["USER", "ADMIN", "SUPER_ADMIN"];
  for (const persona of personas) assert.equal(roles.includes(persona), false);
  for (const status of personaStatuses) assert.equal(roles.includes(status), false);
});

test("legacyPersonaFromProfileType maps every known legacy profileType 1:1 (learner/teacher/avs/parent/specialist/institution)", () => {
  assert.equal(legacyPersonaFromProfileType("learner"), "STUDENT");
  assert.equal(legacyPersonaFromProfileType("teacher"), "TEACHER");
  assert.equal(legacyPersonaFromProfileType("avs"), "AVS");
  assert.equal(legacyPersonaFromProfileType("parent"), "PARENT");
  assert.equal(legacyPersonaFromProfileType("specialist"), "SPECIALIST");
  assert.equal(legacyPersonaFromProfileType("institution"), "ORGANIZATION");
});

// LEGACY-ONLY defensive fallback: covers reading a pre-existing/historical
// DB row that could not go through parseRegistrationProfileType's strict
// gate. This is NOT the new-registration path — see the tests below for
// how new registration input is actually rejected, not defaulted.
test("legacyPersonaFromProfileType defaults an unrecognized legacy value to STUDENT (never a professional/elevated persona) — for historical-row reads only", () => {
  for (const malformed of ["hacker", "ADMIN", "SUPER_ADMIN", "TEACHER", "teacher; DROP TABLE", "", "null", "undefined", "0"]) {
    assert.equal(legacyPersonaFromProfileType(malformed), "STUDENT", `expected malformed value "${malformed}" to default to STUDENT`);
  }
});

test("parseRegistrationProfileType (STRICT, new-registration boundary): accepts exactly the six supported values, mapping 1:1", () => {
  assert.equal(parseRegistrationProfileType("learner"), "learner");
  assert.equal(parseRegistrationProfileType("teacher"), "teacher");
  assert.equal(parseRegistrationProfileType("avs"), "avs");
  assert.equal(parseRegistrationProfileType("parent"), "parent");
  assert.equal(parseRegistrationProfileType("specialist"), "specialist");
  assert.equal(parseRegistrationProfileType("institution"), "institution");
  for (const value of ["learner", "teacher", "avs", "parent", "specialist", "institution"] as const) {
    const parsed = parseRegistrationProfileType(value);
    assert.ok(parsed);
    assert.equal(profileTypeToPersona[parsed], profileTypeToPersona[value]);
  }
});

test("parseRegistrationProfileType rejects unknown, empty, malformed, and arbitrary client-defined values — never defaults to STUDENT", () => {
  for (const malformed of [
    "hacker",
    "",
    "ADMIN",
    "SUPER_ADMIN",
    "TEACHER",
    "STUDENT",
    "Teacher",
    "teacher ",
    " teacher",
    "teacher; DROP TABLE",
    "null",
    "undefined",
    "0",
    "<script>",
  ]) {
    assert.equal(parseRegistrationProfileType(malformed), null, `expected "${malformed}" to be rejected, not silently mapped`);
  }
});

test("parseRegistrationProfileType rejects non-string input (wrong type from a crafted request)", () => {
  for (const malformed of [null, undefined, 0, 1, true, false, {}, [], ["teacher"]]) {
    assert.equal(parseRegistrationProfileType(malformed), null);
  }
});

test("an attacker cannot obtain a professional persona (or any persona) from malformed registration input: rejection returns null for every non-canonical value, so no persona/user can be derived from it", () => {
  for (const malformed of ["teacher-admin", "ORGANIZATION", "avs_pending_review_bypass", "{{7*7}}"]) {
    assert.equal(parseRegistrationProfileType(malformed), null);
  }
});

test("defaultStatusFor: STUDENT/PARENT are immediately ACTIVE; TEACHER/AVS/SPECIALIST/ORGANIZATION require review", () => {
  assert.equal(defaultStatusFor("STUDENT"), "ACTIVE");
  assert.equal(defaultStatusFor("PARENT"), "ACTIVE");
  assert.equal(defaultStatusFor("TEACHER"), "PENDING_REVIEW");
  assert.equal(defaultStatusFor("AVS"), "PENDING_REVIEW");
  assert.equal(defaultStatusFor("SPECIALIST"), "PENDING_REVIEW");
  assert.equal(defaultStatusFor("ORGANIZATION"), "PENDING_REVIEW");
});

test("isProfessionalPersona matches exactly the personas requiring PENDING_REVIEW", () => {
  for (const persona of personas) assert.equal(isProfessionalPersona(persona), defaultStatusFor(persona) === "PENDING_REVIEW");
});

test("every persona has exactly one portal path, and STUDENT/PARENT paths are distinct from professional portal paths", () => {
  for (const persona of personas) assert.equal(typeof personaPortalPath[persona], "string");
  const paths = Object.values(personaPortalPath);
  assert.equal(new Set(paths).size, paths.length, "portal paths must be unique per persona");
});
