import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { user, userProfile } from "@/server/db/schema";
import { establishOnboardingPersonaTx, type DbClient } from "@/server/services/personas";
import { provisionCrmContactForUser } from "@/server/services/crm-onboarding";
import { enqueueSystemWelcomeWhatsAppMessage } from "@/server/services/whatsapp";
import { env, whatsappAutoWelcomeConfigured } from "@/server/env";
import { logger } from "@/server/security/logger";

const namePattern = /^[\p{L}\p{M}' -]{1,80}$/u;
const phonePattern = /^\+[1-9]\d{6,14}$/;

export const TUNISIA_GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Le Kef",
  "Mahdia",
  "La Manouba",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;

const requestedPersonaEnum = z.enum(["STUDENT", "AVS", "PARENT", "TEACHER", "SPECIALIST", "ORGANIZATION"]);

const baseProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).regex(namePattern),
    lastName: z.string().trim().min(1).max(80).regex(namePattern),
    birthDate: z.string().datetime().optional(),
    birthYear: z.number().int().min(1900).max(new Date().getUTCFullYear()).optional(),
    phoneNumber: z.string().trim().regex(phonePattern),
    country: z.string().trim().min(1).max(80),
    governorate: z.enum(TUNISIA_GOVERNORATES),
    city: z.string().trim().min(1).max(120),
    preferredLocale: z.enum(["fr", "ar"]),
    requestedPersona: requestedPersonaEnum,
    educationLevel: z.string().trim().min(1).max(120).optional(),
    institutionName: z.string().trim().min(1).max(160).optional(),
    termsAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
  })
  .strict();

/**
 * Persona-conditional requirements, authoritative server-side (never trust
 * client-side step gating). Deliberately reuses the existing
 * educationLevel/institutionName userProfile columns instead of inventing
 * new ones:
 * - birthDate/birthYear are NEVER required by onboarding, for any persona.
 *   Repo-wide search found zero downstream functional dependents (no
 *   age-gated content, no minor-consent workflow, no certificate/analytics/
 *   authorization use) and no documented/product requirement that ANEI is
 *   adults-only - requiring or age-gating on it would be data collected
 *   "just in case", which data-minimization forbids. The columns remain in
 *   the schema (and in the DB) for backward compatibility with any
 *   historical rows, but the onboarding wizard no longer asks for them.
 * - PARENT needs neither educationLevel nor institutionName (not a
 *   professional/academic attribute of the parent themselves).
 * - STUDENT needs both educationLevel and institutionName (existing
 *   behavior, unchanged).
 * - TEACHER/AVS/SPECIALIST require institutionName (employer/organization,
 *   needed for admin review) but educationLevel (qualification) stays
 *   optional - no product requirement makes it a hard blocker.
 */
export const profileSchema = baseProfileSchema.superRefine((data, ctx) => {
  const isParent = data.requestedPersona === "PARENT";
  const isStudent = data.requestedPersona === "STUDENT";

  if (!isParent && !data.institutionName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "institution_required", path: ["institutionName"] });
  }

  if (isStudent && !data.educationLevel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "education_level_required", path: ["educationLevel"] });
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

export const learnerProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).regex(namePattern),
  lastName: z.string().trim().min(1).max(80).regex(namePattern),
  country: z.string().trim().min(1).max(80),
  governorate: z.enum(TUNISIA_GOVERNORATES),
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
      educationLevel: data.educationLevel ?? null,
      institutionName: data.institutionName ?? null,
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
        educationLevel: data.educationLevel ?? null,
        institutionName: data.institutionName ?? null,
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
