import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { personaMembership, user, userProfile } from "@/server/db/schema";
import { establishOnboardingPersonaTx, type DbClient } from "@/server/services/personas";
import {
  upsertAvsProfileTx,
  upsertOrganizationProfileTx,
  upsertSpecialistProfileTx,
  upsertTeacherProfileTx,
} from "@/server/services/persona-profiles";
import { provisionCrmContactForUser } from "@/server/services/crm-onboarding";
import { enqueueSystemWelcomeWhatsAppMessage } from "@/server/services/whatsapp";
import { env, whatsappAutoWelcomeConfigured } from "@/server/env";
import { logger } from "@/server/security/logger";
import { normalizeTunisiaPhone } from "@/lib/tunisia/phone";
import { TUNISIA_GOVERNORATE_NAMES, isValidGovernorateDelegation } from "@/lib/tunisia/locations";

const namePattern = /^[\p{L}\p{M}' -]{1,80}$/u;

/**
 * Canonical governorate name list, kept exported under its historical name
 * for backward compatibility with existing importers - now sourced from the
 * single Tunisia administrative dataset (src/lib/tunisia/locations.ts)
 * instead of a duplicated local array.
 */
export const TUNISIA_GOVERNORATES = TUNISIA_GOVERNORATE_NAMES;

// Shared field builders reused across every persona-specific variant below,
// so the phone/location normalization logic exists in exactly one place.
const phoneNumberField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeTunisiaPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_phone" });
      return z.NEVER;
    }
    return normalized;
  });
const governorateField = z.string().refine((value) => (TUNISIA_GOVERNORATE_NAMES as readonly string[]).includes(value), {
  message: "invalid_governorate",
});
const cityField = z.string().trim().min(1).max(120);
const experienceYearsField = z.number().int().min(0).max(80).optional();
const domainListField = z.array(z.string().trim().min(1).max(60)).max(20).optional();

/**
 * Common identity/contact/location fields, shared by every persona - never
 * ambiguous professional data (see src/server/db/schema.ts persona-profile
 * comment: that lives in persona-specific tables, not here).
 *
 * birthDate/birthYear are NEVER required by onboarding, for any persona.
 * Repo-wide search found zero downstream functional dependents (no
 * age-gated content, no minor-consent workflow, no certificate/analytics/
 * authorization use) and no documented/product requirement that ANEI is
 * adults-only - requiring or age-gating on it would be data collected "just
 * in case", which data-minimization forbids. The columns remain in the
 * schema for backward compatibility with historical rows, but the
 * onboarding wizard no longer asks for them.
 */
const commonFieldsSchema = z.object({
  firstName: z.string().trim().min(1).max(80).regex(namePattern),
  lastName: z.string().trim().min(1).max(80).regex(namePattern),
  birthDate: z.string().datetime().optional(),
  birthYear: z.number().int().min(1900).max(new Date().getUTCFullYear()).optional(),
  phoneNumber: phoneNumberField,
  country: z.string().trim().min(1).max(80),
  governorate: governorateField,
  city: cityField,
  preferredLocale: z.enum(["fr", "ar"]),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
});

// STUDENT needs both educationLevel and institutionName (existing behavior,
// unchanged) - these two userProfile columns are STUDENT-only in meaning
// going forward; professional personas persist their own equivalents in
// their dedicated profile table instead (see persona-profiles.ts).
const studentProfileSchema = commonFieldsSchema
  .extend({
    requestedPersona: z.literal("STUDENT"),
    educationLevel: z.string().trim().min(1, "education_level_required").max(120),
    institutionName: z.string().trim().min(1, "institution_required").max(160),
  })
  .strict();

// PARENT has no persona-specific fields at all - the common fields are
// enough, and child linking is a separate explicit authorization flow
// (parent_student_link), never collected during onboarding.
const parentProfileSchema = commonFieldsSchema
  .extend({
    requestedPersona: z.literal("PARENT"),
  })
  .strict();

const teacherProfileSchema = commonFieldsSchema
  .extend({
    requestedPersona: z.literal("TEACHER"),
    discipline: z.string().trim().min(1).max(120).optional(),
    qualification: z.string().trim().min(1).max(160).optional(),
    experienceYears: experienceYearsField,
    levelsTaught: domainListField,
    professionalInstitution: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const avsProfileSchema = commonFieldsSchema
  .extend({
    requestedPersona: z.literal("AVS"),
    qualification: z.string().trim().min(1).max(160).optional(),
    experienceYears: experienceYearsField,
    interventionDomains: domainListField,
  })
  .strict();

const specialistProfileSchema = commonFieldsSchema
  .extend({
    requestedPersona: z.literal("SPECIALIST"),
    specialty: z.string().trim().min(1).max(120).optional(),
    qualification: z.string().trim().min(1).max(160).optional(),
    experienceYears: experienceYearsField,
    practiceStructure: z.string().trim().min(1).max(160).optional(),
    interventionDomains: domainListField,
  })
  .strict();

// organizationName is required (the organization's declared name is
// essential for admin review); type/representative role stay optional.
// This is pre-approval application data only - it never creates an
// `organization`/`organization_membership` row by itself (see
// src/server/services/persona-profiles.ts).
const organizationProfileSchema = commonFieldsSchema
  .extend({
    requestedPersona: z.literal("ORGANIZATION"),
    organizationName: z.string().trim().min(1, "institution_required").max(160),
    organizationType: z.string().trim().min(1).max(120).optional(),
    representativeRole: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const profileSchemaUnion = z.discriminatedUnion("requestedPersona", [
  studentProfileSchema,
  parentProfileSchema,
  teacherProfileSchema,
  avsProfileSchema,
  specialistProfileSchema,
  organizationProfileSchema,
]);

/**
 * Authoritative server-side schema (never trust client-side step gating).
 * Persona-specific requirements live entirely in each variant above; the
 * only cross-cutting rule left here is the governorate/delegation pairing,
 * which applies identically regardless of persona.
 */
export const profileSchema = profileSchemaUnion.superRefine((data, ctx) => {
  // Authoritative governorate/delegation relationship check - the client
  // combobox already filters by governorate, but the browser is never
  // trusted as the source of truth for this administrative pairing.
  if (!isValidGovernorateDelegation(data.governorate, data.city)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_delegation", path: ["city"] });
  }
});

function toLegacyProfileType(persona: z.infer<typeof profileSchema>["requestedPersona"]) {
  switch (persona) {
    case "STUDENT":
      return "learner";
    case "TEACHER":
      return "teacher";
    case "AVS":
      return "avs";
    case "PARENT":
      return "parent";
    case "SPECIALIST":
      return "specialist";
    case "ORGANIZATION":
      return "institution";
  }
}

export async function getUserProfile(userId: string) {
  const [row] = await db.select().from(userProfile).where(eq(userProfile.userId, userId)).limit(1);
  return row ?? null;
}

// Deliberately NOT cross-validating city against the governorate's
// delegation list here (unlike profileSchema below): this schema still
// backs the existing free-text city input on the student's own
// /dashboard/profil edit form (LearnerProfileForm), which this task does
// not redesign - adding that constraint here would reject legacy/valid
// values the current UI never collected as a structured delegation.
export const learnerProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).regex(namePattern),
  lastName: z.string().trim().min(1).max(80).regex(namePattern),
  country: z.string().trim().min(1).max(80),
  governorate: z.string().refine((value) => (TUNISIA_GOVERNORATE_NAMES as readonly string[]).includes(value), {
    message: "invalid_governorate",
  }),
  city: z.string().trim().min(1).max(120),
  preferredLocale: z.enum(["fr", "ar"]),
  educationLevel: z.string().trim().min(1).max(120),
  institutionName: z.string().trim().min(1).max(160),
}).strict();

export async function updateLearnerProfile(userId: string, raw: unknown) {
  const parsed = learnerProfileUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "INVALID_PROFILE", details: parsed.error.flatten() };
  const data = parsed.data;
  const now = new Date();
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(userProfile).set({ ...data, updatedAt: now }).where(eq(userProfile.userId, userId)).returning({ id: userProfile.id });
    if (!updated) return { ok: false as const, error: "PROFILE_NOT_FOUND" };
    await tx.update(user).set({ name: `${data.firstName} ${data.lastName}`.trim(), locale: data.preferredLocale, updatedAt: now }).where(eq(user.id, userId));
    return { ok: true as const };
  });
}

export function isOnboardingCompleted(profile: Awaited<ReturnType<typeof getUserProfile>>): boolean {
  return Boolean(profile?.onboardingCompletedAt);
}

type ProfileData = z.infer<typeof profileSchema>;

type CompleteProfileTxResult = { ok: true } | { ok: false; error: "ONBOARDING_ALREADY_COMPLETED" };

/**
 * The single authoritative onboarding write: advisory lock + persona
 * reconciliation + `user`/`userProfile` writes, all on the caller-supplied
 * `tx`. Extracted from `completeUserProfile` so the rollback-atomicity
 * invariant (persona, profileType, and requestedPersona always agree after
 * commit) can be exercised directly in tests via `db.transaction` + a forced
 * error, without needing to fake an HTTP/CRM boundary.
 */
export async function completeUserProfileTx(
  tx: DbClient,
  userId: string,
  data: ProfileData,
  now: Date,
  birthDate: Date | null,
  onboardingAlreadyCompleted: boolean,
): Promise<CompleteProfileTxResult> {
  // Persona reconciliation happens BEFORE the profile is persisted, and the
  // whole completion is aborted if it is rejected. Both this call and the
  // user/userProfile writes below run on the same `tx`, so a rejection or a
  // later failure rolls back the persona change together with the profile
  // write - a successful commit can never leave requestedPersona/profileType
  // pointing at one persona while personaMembership.isPrimary points at
  // another - the exact primary-persona-mismatch bug this replaces.
  const personaResult = await establishOnboardingPersonaTx(tx, userId, data.requestedPersona, onboardingAlreadyCompleted);
  if (personaResult.kind === "locked") {
    return { ok: false as const, error: "ONBOARDING_ALREADY_COMPLETED" };
  }

  // educationLevel/institutionName are STUDENT-only in meaning now -
  // professional personas persist their own equivalents in their dedicated
  // profile table below instead of these shared userProfile columns.
  const educationLevel = data.requestedPersona === "STUDENT" ? data.educationLevel : null;
  const institutionName = data.requestedPersona === "STUDENT" ? data.institutionName : null;

  await tx
    .insert(userProfile)
    .values({
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate,
      birthYear: data.birthYear ?? null,
      phoneNumber: data.phoneNumber ?? null,
      country: data.country,
      governorate: data.governorate,
      city: data.city,
      preferredLocale: data.preferredLocale,
      requestedPersona: data.requestedPersona,
      educationLevel,
      institutionName,
      onboardingCompletedAt: now,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userProfile.userId,
      set: {
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate,
        birthYear: data.birthYear ?? null,
        phoneNumber: data.phoneNumber ?? null,
        country: data.country,
        governorate: data.governorate,
        city: data.city,
        preferredLocale: data.preferredLocale,
        requestedPersona: data.requestedPersona,
        educationLevel,
        institutionName,
        onboardingCompletedAt: now,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        updatedAt: now,
      },
    });

  await tx
    .update(user)
    .set({
      name: `${data.firstName} ${data.lastName}`.trim(),
      locale: data.preferredLocale,
      profileType: toLegacyProfileType(data.requestedPersona),
      updatedAt: now,
    })
    .where(and(eq(user.id, userId)));

  // Persona-specific profile persistence - reads back the membership row
  // establishOnboardingPersonaTx above just created/confirmed, so the
  // upsert is always anchored to a real, type-checked membership rather
  // than any client-supplied id (see persona-profiles.ts).
  if (
    data.requestedPersona === "TEACHER" ||
    data.requestedPersona === "AVS" ||
    data.requestedPersona === "SPECIALIST" ||
    data.requestedPersona === "ORGANIZATION"
  ) {
    const [membership] = await tx
      .select({ id: personaMembership.id })
      .from(personaMembership)
      .where(and(eq(personaMembership.userId, userId), eq(personaMembership.persona, data.requestedPersona)))
      .limit(1);
    if (!membership) throw new Error("persona_membership missing after establishOnboardingPersonaTx");

    if (data.requestedPersona === "TEACHER") {
      await upsertTeacherProfileTx(tx, membership.id, {
        discipline: data.discipline ?? null,
        qualification: data.qualification ?? null,
        experienceYears: data.experienceYears ?? null,
        levelsTaught: data.levelsTaught ?? null,
        professionalInstitution: data.professionalInstitution ?? null,
      });
    } else if (data.requestedPersona === "AVS") {
      await upsertAvsProfileTx(tx, membership.id, {
        qualification: data.qualification ?? null,
        experienceYears: data.experienceYears ?? null,
        interventionDomains: data.interventionDomains ?? null,
      });
    } else if (data.requestedPersona === "SPECIALIST") {
      await upsertSpecialistProfileTx(tx, membership.id, {
        specialty: data.specialty ?? null,
        qualification: data.qualification ?? null,
        experienceYears: data.experienceYears ?? null,
        practiceStructure: data.practiceStructure ?? null,
        interventionDomains: data.interventionDomains ?? null,
      });
    } else {
      await upsertOrganizationProfileTx(tx, membership.id, {
        organizationName: data.organizationName,
        organizationType: data.organizationType ?? null,
        representativeRole: data.representativeRole ?? null,
      });
    }
  }

  return { ok: true as const };
}

export async function completeUserProfile(userId: string, raw: unknown) {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "INVALID_PROFILE", details: parsed.error.flatten() };
  const data = parsed.data;
  const now = new Date();
  const birthDate = data.birthDate ? new Date(data.birthDate) : null;
  if (birthDate && birthDate.getTime() > Date.now()) {
    return { ok: false as const, error: "INVALID_BIRTH_DATE" };
  }

  const priorProfile = await getUserProfile(userId);
  const isFirstCompletion = !isOnboardingCompleted(priorProfile);

  const result = await db.transaction((tx) => completeUserProfileTx(tx, userId, data, now, birthDate, !isFirstCompletion));
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  // CRM + WhatsApp welcome provisioning runs in its OWN transaction, strictly
  // after the profile-save transaction has committed. Deliberately not
  // nested inside the profile transaction: a Postgres-level error here (e.g.
  // a constraint violation) would otherwise poison and roll back the
  // learner's own profile save, which must never depend on CRM/WhatsApp
  // being configured or healthy. `provisionCrmContactForUser` is idempotent,
  // so a later retry (e.g. the learner re-saving their profile) safely
  // reconciles the CRM contact if this best-effort step failed.
  try {
    const [userRow] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
    await db.transaction(async (tx) => {
      const { contactId, organizationId } = await provisionCrmContactForUser(tx, userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: userRow?.email ?? null,
        phone: data.phoneNumber,
      });

      if (isFirstCompletion && whatsappAutoWelcomeConfigured) {
        await enqueueSystemWelcomeWhatsAppMessage(
          organizationId,
          {
            contactId,
            templateName: env.WHATSAPP_WELCOME_TEMPLATE_NAME,
            language: data.preferredLocale,
            firstName: data.firstName,
            requestId: `welcome:${userId}`,
          },
          tx,
        );
      }
    });
  } catch (error) {
    logger.warn("crm_onboarding.provisioning_failed", { userId, error: error instanceof Error ? error.message : "unknown" });
  }

  return { ok: true as const };
}
