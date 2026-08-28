import test from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "../../src/server/auth/profile";

const now = new Date();

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Amira",
    lastName: "Ben Salah",
    phoneNumber: "+21620000000",
    country: "Tunisie",
    governorate: "Tunis",
    city: "Tunis",
    preferredLocale: "fr",
    termsAccepted: true,
    privacyAccepted: true,
    ...overrides,
  };
}

test("STUDENT: valid profile succeeds without any birth date/year and requires educationLevel + institutionName", () => {
  const ok = profileSchema.safeParse(basePayload({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET" }));
  assert.equal(ok.success, true);

  const missingEducation = profileSchema.safeParse(basePayload({ requestedPersona: "STUDENT", institutionName: "ISET" }));
  assert.equal(missingEducation.success, false);
  if (!missingEducation.success) {
    assert.deepEqual(missingEducation.error.flatten().fieldErrors.educationLevel, ["education_level_required"]);
  }

  const missingInstitution = profileSchema.safeParse(basePayload({ requestedPersona: "STUDENT", educationLevel: "Licence" }));
  assert.equal(missingInstitution.success, false);
  if (!missingInstitution.success) {
    assert.deepEqual(missingInstitution.error.flatten().fieldErrors.institutionName, ["institution_required"]);
  }
});

test("STUDENT: no 18+/adult restriction remains - repo-wide search found no functional or documented business dependency on it", () => {
  const youngBirthYear = profileSchema.safeParse(
    basePayload({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET", birthYear: now.getUTCFullYear() - 10 }),
  );
  assert.equal(youngBirthYear.success, true);
});

test("PARENT: does not require educationLevel or institutionName", () => {
  const result = profileSchema.safeParse(basePayload({ requestedPersona: "PARENT" }));
  assert.equal(result.success, true);
});

for (const persona of ["TEACHER", "AVS", "SPECIALIST"] as const) {
  test(`${persona}: requires institutionName (employer/organization) but not educationLevel`, () => {
    const withoutInstitution = profileSchema.safeParse(basePayload({ requestedPersona: persona }));
    assert.equal(withoutInstitution.success, false);
    if (!withoutInstitution.success) {
      assert.deepEqual(withoutInstitution.error.flatten().fieldErrors.institutionName, ["institution_required"]);
    }

    const valid = profileSchema.safeParse(basePayload({ requestedPersona: persona, institutionName: "ANEI" }));
    assert.equal(valid.success, true);
  });
}

test("ORGANIZATION: requires institutionName (organization name) but never asks for birth data or educationLevel", () => {
  const valid = profileSchema.safeParse(basePayload({ requestedPersona: "ORGANIZATION", institutionName: "Association ANEI" }));
  assert.equal(valid.success, true);

  const withoutInstitution = profileSchema.safeParse(basePayload({ requestedPersona: "ORGANIZATION" }));
  assert.equal(withoutInstitution.success, false);
  if (!withoutInstitution.success) {
    assert.deepEqual(withoutInstitution.error.flatten().fieldErrors.institutionName, ["institution_required"]);
  }
});

test("all six personas can complete onboarding without submitting any birth date/year", () => {
  const payloads: Record<string, unknown>[] = [
    basePayload({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET" }),
    basePayload({ requestedPersona: "PARENT" }),
    basePayload({ requestedPersona: "TEACHER", institutionName: "ANEI" }),
    basePayload({ requestedPersona: "AVS", institutionName: "ANEI" }),
    basePayload({ requestedPersona: "SPECIALIST", institutionName: "ANEI" }),
    basePayload({ requestedPersona: "ORGANIZATION", institutionName: "Association ANEI" }),
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
    const result = profileSchema.safeParse(basePayload({ requestedPersona: "STUDENT", educationLevel: "Licence", institutionName: "ISET", ...extra }));
    assert.equal(result.success, false, `expected rejection for extra field ${JSON.stringify(extra)}`);
  }
});

test("rejects an unrecognized requestedPersona value", () => {
  const result = profileSchema.safeParse(basePayload({ requestedPersona: "SUPER_ADMIN" }));
  assert.equal(result.success, false);
});
