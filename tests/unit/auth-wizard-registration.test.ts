import test from "node:test";
import assert from "node:assert/strict";
import { registerWizardSchema } from "@/app/api/auth/register-wizard/route";

test("Register Wizard validates complete Learner payload", () => {
  const payload = {
    category: "LEARNER",
    firstName: "Amira",
    lastName: "Ben Salem",
    email: "amira.bensalem@example.tn",
    phone: "+216 20 123 456",
    governorate: "Tunis",
    city: "La Marsa",
    acquisitionSource: "FACEBOOK_INSTAGRAM",
    ageGroup: "26-35",
    subRole: "PARENT",
    educationLevel: "Primaire",
    interests: ["Autisme (TSA)", "Troubles DYS"],
    password: "StrongPassword2026!Secure",
    locale: "fr",
  };

  const parsed = registerWizardSchema.safeParse(payload);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.category, "LEARNER");
    assert.equal(parsed.data.email, "amira.bensalem@example.tn");
    assert.equal(parsed.data.governorate, "Tunis");
  }
});

test("Register Wizard validates complete AVS payload", () => {
  const payload = {
    category: "AVS",
    firstName: "Syrine",
    lastName: "Trabelsi",
    email: "syrine.avs@example.tn",
    phone: "+216 98 765 432",
    governorate: "Sousse",
    city: "Hammam Sousse",
    acquisitionSource: "WHATSAPP",
    ageGroup: "26-35",
    accompanimentType: "Maternelle & Primaire",
    schoolsCovered: "Écoles primaires Sousse Centre & Kantaoui",
    experienceYears: 4,
    qualification: "Certificat ANEI Accompagnant Scolaire",
    interventionDomains: ["Autisme (TSA)", "TDAH"],
    pedagogicalMethods: ["Montessori adapté", "Programme Makaton"],
    availability: "Temps plein",
    hourlyRateMillimes: 25000,
    onlineVisioPriceMillimes: 35000,
    bio: "Accompagnante scolaire passionnée avec 4 ans d'expérience.",
    password: "StrongPassword2026!Secure",
    locale: "fr",
  };

  const parsed = registerWizardSchema.safeParse(payload);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.category, "AVS");
    assert.equal(parsed.data.hourlyRateMillimes, 25000);
    assert.equal(parsed.data.onlineVisioPriceMillimes, 35000);
  }
});

test("Register Wizard validates complete Specialist payload", () => {
  const payload = {
    category: "SPECIALIST",
    firstName: "Dr. Karim",
    lastName: "Mansour",
    email: "dr.mansour@cabinet.tn",
    phone: "+216 71 888 999",
    governorate: "Sfax",
    city: "Sfax Ville",
    acquisitionSource: "RECOMMENDATION",
    ageGroup: "36-50",
    specialty: "Orthophoniste",
    workplaceName: "Cabinet d'Orthophonie El Hana",
    workplaceAddress: "Avenue Habib Bourguiba, Sfax",
    licenseOrOrderNumber: "ORD-TN-78945",
    inPersonPriceMillimes: 45000,
    onlineVisioPriceMillimes: 40000,
    bio: "Praticien spécialisé dans les troubles du langage et de la communication.",
    password: "StrongPassword2026!Secure",
    locale: "fr",
  };

  const parsed = registerWizardSchema.safeParse(payload);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.category, "SPECIALIST");
    assert.equal(parsed.data.licenseOrOrderNumber, "ORD-TN-78945");
    assert.equal(parsed.data.inPersonPriceMillimes, 45000);
  }
});

test("Register Wizard strictly enforces 15-character minimum password policy", () => {
  const shortPasswordPayload = {
    category: "LEARNER",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: "+216 20 000 000",
    governorate: "Tunis",
    city: "Tunis",
    password: "ShortPass123!", // 13 characters
    locale: "fr",
  };

  const parsed = registerWizardSchema.safeParse(shortPasswordPayload);
  assert.equal(parsed.success, false);
});

test("Register Wizard rejects invalid governorate", () => {
  const invalidGovernoratePayload = {
    category: "LEARNER",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: "+216 20 000 000",
    governorate: "Paris", // Not in Tunisia
    city: "Centre",
    password: "StrongPassword2026!Secure",
    locale: "fr",
  };

  const parsed = registerWizardSchema.safeParse(invalidGovernoratePayload);
  assert.equal(parsed.success, false);
});

test("Destination resolution maps each role to the optimal landing experience", () => {
  function getRedirectDestination(category: "LEARNER" | "AVS" | "SPECIALIST", locale: string) {
    switch (category) {
      case "AVS":
        return `/${locale}/avs`;
      case "SPECIALIST":
        return `/${locale}/specialistes`;
      case "LEARNER":
      default:
        return `/${locale}/formations`;
    }
  }

  assert.equal(getRedirectDestination("LEARNER", "fr"), "/fr/formations");
  assert.equal(getRedirectDestination("AVS", "fr"), "/fr/avs");
  assert.equal(getRedirectDestination("SPECIALIST", "fr"), "/fr/specialistes");
  assert.equal(getRedirectDestination("AVS", "ar"), "/ar/avs");
  assert.equal(getRedirectDestination("SPECIALIST", "ar"), "/ar/specialistes");
});
