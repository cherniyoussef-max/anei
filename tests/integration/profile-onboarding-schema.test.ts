import test from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "../../src/server/auth/profile";

const now = new Date();

function commonFields(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Amira",
    lastName: "Ben Salah",
    phoneNumber: "+21620000000",
    country: "Tunisie",
    governorate: "Tunis",
    city: "Carthage",
    preferredLocale: "fr",
    termsAccepted: true,
    privacyAccepted: true,
    ...overrides,
  };
}

test("STUDENT: valid profile succeeds without any birth date/year and requires educationLevel + institutionName", () => {
  const ok = profileSchema.safeParse(commonFields({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET" }));
  assert.equal(ok.success, true);

  const missingEducation = profileSchema.safeParse(commonFields({ requestedPersona: "STUDENT", institutionName: "ISET" }));
  assert.equal(missingEducation.success, false);

  const missingInstitution = profileSchema.safeParse(commonFields({ requestedPersona: "STUDENT", educationLevel: "Licence" }));
  assert.equal(missingInstitution.success, false);
});

test("STUDENT: no 18+/adult restriction remains - repo-wide search found no functional or documented business dependency on it", () => {
  const youngBirthYear = profileSchema.safeParse(
    commonFields({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET", birthYear: now.getUTCFullYear() - 10 }),
  );
  assert.equal(youngBirthYear.success, true);
});

test("STUDENT: rejects teacher-only fields (discipline is not part of the STUDENT variant)", () => {
  const result = profileSchema.safeParse(
    commonFields({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET", discipline: "Mathematics" }),
  );
  assert.equal(result.success, false);
});

test("PARENT: succeeds with only common fields, and rejects any student/professional field", () => {
  const ok = profileSchema.safeParse(commonFields({ requestedPersona: "PARENT" }));
  assert.equal(ok.success, true);

  for (const extra of [{ educationLevel: "Licence" }, { institutionName: "ISET" }, { discipline: "Math" }, { specialty: "Orthophonie" }, { organizationName: "ANEI" }]) {
    const rejected = profileSchema.safeParse(commonFields({ requestedPersona: "PARENT", ...extra }));
    assert.equal(rejected.success, false, `PARENT must reject extra field ${JSON.stringify(extra)}`);
  }
});

test("TEACHER: all professional fields are optional, and student/other-persona fields are rejected", () => {
  const minimal = profileSchema.safeParse(commonFields({ requestedPersona: "TEACHER" }));
  assert.equal(minimal.success, true);

  const full = profileSchema.safeParse(
    commonFields({
      requestedPersona: "TEACHER",
      discipline: "Mathematics",
      qualification: "Master",
      experienceYears: 6,
      levelsTaught: ["Secondaire", "Université"],
      professionalInstitution: "Lycée Pilote",
    }),
  );
  assert.equal(full.success, true);
  if (full.success && full.data.requestedPersona === "TEACHER") {
    assert.equal(full.data.discipline, "Mathematics");
    assert.deepEqual(full.data.levelsTaught, ["Secondaire", "Université"]);
  }

  const rejectsStudentField = profileSchema.safeParse(commonFields({ requestedPersona: "TEACHER", educationLevel: "Licence" }));
  assert.equal(rejectsStudentField.success, false);

  const rejectsSpecialistField = profileSchema.safeParse(commonFields({ requestedPersona: "TEACHER", specialty: "Orthophonie" }));
  assert.equal(rejectsSpecialistField.success, false);
});

test("TEACHER: experienceYears is bounded to [0, 80]", () => {
  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "TEACHER", experienceYears: -1 })).success, false);
  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "TEACHER", experienceYears: 81 })).success, false);
  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "TEACHER", experienceYears: 0 })).success, true);
  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "TEACHER", experienceYears: 80 })).success, true);
});

test("AVS: professional fields optional, student/teacher/specialist fields rejected", () => {
  const minimal = profileSchema.safeParse(commonFields({ requestedPersona: "AVS" }));
  assert.equal(minimal.success, true);

  const full = profileSchema.safeParse(
    commonFields({ requestedPersona: "AVS", qualification: "Formation AVS", experienceYears: 3, interventionDomains: ["Autisme", "DYS"] }),
  );
  assert.equal(full.success, true);

  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "AVS", institutionName: "ISET" })).success, false);
  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "AVS", discipline: "Math" })).success, false);
});

test("SPECIALIST: professional fields optional, student/teacher/AVS fields rejected", () => {
  const minimal = profileSchema.safeParse(commonFields({ requestedPersona: "SPECIALIST" }));
  assert.equal(minimal.success, true);

  const full = profileSchema.safeParse(
    commonFields({
      requestedPersona: "SPECIALIST",
      specialty: "Orthophonie",
      qualification: "Doctorat",
      experienceYears: 10,
      practiceStructure: "Cabinet privé",
      interventionDomains: ["Langage"],
    }),
  );
  assert.equal(full.success, true);

  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "SPECIALIST", discipline: "Math" })).success, false);
  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "SPECIALIST", educationLevel: "Licence" })).success, false);
});

test("ORGANIZATION: requires organizationName, rejects student/professional-person fields", () => {
  const missingName = profileSchema.safeParse(commonFields({ requestedPersona: "ORGANIZATION" }));
  assert.equal(missingName.success, false);

  const ok = profileSchema.safeParse(
    commonFields({ requestedPersona: "ORGANIZATION", organizationName: "Association ANEI", organizationType: "Association", representativeRole: "Directeur" }),
  );
  assert.equal(ok.success, true);

  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "ORGANIZATION", organizationName: "ANEI", educationLevel: "Licence" })).success, false);
  assert.equal(profileSchema.safeParse(commonFields({ requestedPersona: "ORGANIZATION", organizationName: "ANEI", discipline: "Math" })).success, false);
});

test("all six personas can complete onboarding without submitting any birth date/year", () => {
  const payloads: Record<string, unknown>[] = [
    commonFields({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET" }),
    commonFields({ requestedPersona: "PARENT" }),
    commonFields({ requestedPersona: "TEACHER" }),
    commonFields({ requestedPersona: "AVS" }),
    commonFields({ requestedPersona: "SPECIALIST" }),
    commonFields({ requestedPersona: "ORGANIZATION", organizationName: "Association ANEI" }),
  ];
  for (const payload of payloads) {
    const result = profileSchema.safeParse(payload);
    assert.equal(result.success, true, `expected persona ${payload.requestedPersona} to succeed without birth data`);
  }
});

test("rejects unknown/privileged fields (role, emailVerified, phoneVerifiedAt, persona status) - never trust client input for these", () => {
  for (const extra of [
    { role: "ADMIN" },
    { emailVerified: true },
    { phoneVerifiedAt: new Date().toISOString() },
    { personaStatus: "ACTIVE" },
    { isPrimary: true },
  ]) {
    const result = profileSchema.safeParse(commonFields({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET", ...extra }));
    assert.equal(result.success, false, `expected rejection for extra field ${JSON.stringify(extra)}`);
  }
});

test("rejects an unrecognized requestedPersona value", () => {
  const result = profileSchema.safeParse(commonFields({ requestedPersona: "SUPER_ADMIN" }));
  assert.equal(result.success, false);
});

test("rejects a governorate/delegation pair that does not belong together", () => {
  const result = profileSchema.safeParse(commonFields({ requestedPersona: "PARENT", governorate: "Sidi Bouzid", city: "La Marsa" }));
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.flatten().fieldErrors.city, ["invalid_delegation"]);
  }
});

test("rejects an unknown governorate name", () => {
  const result = profileSchema.safeParse(commonFields({ requestedPersona: "PARENT", governorate: "Not A Governorate", city: "Carthage" }));
  assert.equal(result.success, false);
});

test("accepts and normalizes an 8-digit local Tunisian phone number to +216XXXXXXXX", () => {
  const result = profileSchema.safeParse(commonFields({ requestedPersona: "PARENT", phoneNumber: "20 311 900" }));
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.phoneNumber, "+21620311900");
});

for (const bad of ["", "123", "202020202020202", "20abcdef", "+216+21620311900", "+21620311"]) {
  test(`rejects malformed phone number: ${JSON.stringify(bad)}`, () => {
    const result = profileSchema.safeParse(commonFields({ requestedPersona: "PARENT", phoneNumber: bad }));
    assert.equal(result.success, false);
  });
}
