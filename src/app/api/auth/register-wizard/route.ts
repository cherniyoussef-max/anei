import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { personaMembership, user, userOnboardingAnalytics } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { completeUserProfileTx } from "@/server/auth/profile";
import { normalizeTunisiaPhone } from "@/lib/tunisia/phone";
import { TUNISIA_GOVERNORATE_NAMES } from "@/lib/tunisia/locations";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getRequestId } from "@/server/auth/request-id";
import { recordAuthEvent } from "@/server/auth/events";
import { env } from "@/server/env";
import type { LegacyProfileType } from "@/modules/personas/domain/permissions";

export const dynamic = "force-dynamic";

export const registerWizardSchema = z.object({
  category: z.enum(["LEARNER", "STUDENT", "PARENT", "TEACHER", "AVS", "SPECIALIST", "ORGANIZATION"]),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(8).max(30),
  governorate: z.string().refine((val) => (TUNISIA_GOVERNORATE_NAMES as readonly string[]).includes(val), {
    message: "invalid_governorate",
  }),
  city: z.string().trim().min(1).max(120),
  acquisitionSource: z.string().trim().max(100).optional(),
  ageGroup: z.string().trim().max(50).optional(),
  // Learner & Student fields
  subRole: z.string().trim().max(80).optional(),
  educationLevel: z.string().trim().max(120).optional(),
  institutionName: z.string().trim().max(160).optional(),
  interests: z.array(z.string().trim().max(60)).optional(),
  // Parent fields
  childNeeds: z.array(z.string().trim().max(60)).optional(),
  childCycle: z.string().trim().max(100).optional(),
  childSchool: z.string().trim().max(160).optional(),
  familyPriorities: z.array(z.string().trim().max(80)).optional(),
  // Teacher fields
  teachingCycle: z.string().trim().max(100).optional(),
  discipline: z.string().trim().max(120).optional(),
  teacherObjectives: z.array(z.string().trim().max(80)).optional(),
  // AVS fields
  accompanimentType: z.string().trim().max(100).optional(),
  schoolsCovered: z.string().trim().max(255).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  qualification: z.string().trim().max(160).optional(),
  interventionDomains: z.array(z.string().trim().max(60)).optional(),
  pedagogicalMethods: z.array(z.string().trim().max(60)).optional(),
  availability: z.string().trim().max(120).optional(),
  hourlyRateMillimes: z.number().int().min(0).max(1000000).optional(),
  onlineVisioPriceMillimes: z.number().int().min(0).max(1000000).optional(),
  // Specialist fields
  specialty: z.string().trim().max(120).optional(),
  workplaceName: z.string().trim().max(160).optional(),
  workplaceAddress: z.string().trim().max(255).optional(),
  licenseOrOrderNumber: z.string().trim().max(80).optional(),
  inPersonPriceMillimes: z.number().int().min(0).max(1000000).optional(),
  bio: z.string().trim().max(2000).optional(),
  // Organization fields
  organizationName: z.string().trim().max(160).optional(),
  organizationType: z.string().trim().max(120).optional(),
  representativeRole: z.string().trim().max(120).optional(),
  organizationSize: z.string().trim().max(60).optional(),
  organizationNeeds: z.array(z.string().trim().max(80)).optional(),
  // Security
  password: z.string().min(15).max(128),
  locale: z.enum(["fr", "ar"]).default("fr"),
  referredByCode: z.string().trim().max(32).optional(),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const rate = await consumeRateLimit(`register-wizard:${clientIp}`, 10, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = registerWizardSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const ar = data.locale === "ar";

  // Check if email already taken
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, data.email))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        error: "EMAIL_ALREADY_EXISTS",
        message: ar ? "البريد الإلكتروني مسجل بالفعل في الأكاديمية" : "Cette adresse e-mail est déjà associée à un compte.",
      },
      { status: 409 },
    );
  }

  const normalizedPhone = normalizeTunisiaPhone(data.phone) || data.phone.trim();
  const rawCat = data.category;
  const isStudent = rawCat === "STUDENT" || rawCat === "LEARNER";
  const isParent = rawCat === "PARENT";
  const isTeacher = rawCat === "TEACHER";
  const isAvs = rawCat === "AVS";
  const isSpecialist = rawCat === "SPECIALIST";
  const isOrg = rawCat === "ORGANIZATION";

  const profileType: LegacyProfileType = isAvs
    ? "avs"
    : isSpecialist
    ? "specialist"
    : isParent
    ? "parent"
    : isTeacher
    ? "teacher"
    : isOrg
    ? "institution"
    : "learner";

  // 1. Create account via Better Auth
  let signUpRes;
  try {
    signUpRes = await auth.api.signUpEmail({
      body: {
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        password: data.password,
        locale: data.locale,
        profileType,
        referredByCode: data.referredByCode,
      },
      headers: request.headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "SIGNUP_FAILED", message: msg }, { status: 400 });
  }

  if (!signUpRes || !signUpRes.user) {
    return NextResponse.json({ error: "USER_CREATION_FAILED" }, { status: 500 });
  }

  const createdUserId = signUpRes.user.id;
  const now = new Date();

  // 2. Atomic completion transaction: userProfile + avsProfiles auto-publish + analytics
  try {
    await db.transaction(async (tx) => {
      // Set phone column on user
      await tx
        .update(user)
        .set({ phone: normalizedPhone, updatedAt: now })
        .where(eq(user.id, createdUserId));

      const common = {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: normalizedPhone,
        country: "Tunisie",
        governorate: data.governorate,
        city: data.city,
        preferredLocale: data.locale,
        termsAccepted: true as const,
        privacyAccepted: true as const,
      };

      if (isStudent) {
        await completeUserProfileTx(
          tx,
          createdUserId,
          {
            ...common,
            requestedPersona: "STUDENT",
            educationLevel: data.educationLevel || "Licence / Études supérieures",
            institutionName: data.institutionName || "Académie ANEI",
            subRole: data.subRole || "Étudiant / En reconversion",
            interests: data.interests || [],
          },
          now,
          null,
          false,
        );
        await tx
          .update(personaMembership)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(and(eq(personaMembership.userId, createdUserId), eq(personaMembership.persona, "STUDENT")));
      } else if (isParent) {
        await completeUserProfileTx(
          tx,
          createdUserId,
          {
            ...common,
            requestedPersona: "PARENT",
          },
          now,
          null,
          false,
        );
        await tx
          .update(personaMembership)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(and(eq(personaMembership.userId, createdUserId), eq(personaMembership.persona, "PARENT")));
      } else if (isTeacher) {
        await completeUserProfileTx(
          tx,
          createdUserId,
          {
            ...common,
            requestedPersona: "TEACHER",
            discipline: data.discipline || "Pédagogie inclusive",
            qualification: data.qualification || "Cadre éducatif",
            experienceYears: data.experienceYears ?? 3,
            professionalInstitution: data.institutionName || "Établissement scolaire",
          },
          now,
          null,
          false,
        );
        await tx
          .update(personaMembership)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(and(eq(personaMembership.userId, createdUserId), eq(personaMembership.persona, "TEACHER")));
      } else if (isAvs) {
        await completeUserProfileTx(
          tx,
          createdUserId,
          {
            ...common,
            requestedPersona: "AVS",
            qualification: data.qualification || "Certificat d'Accompagnant de Vie Scolaire (AVS)",
            experienceYears: data.experienceYears ?? 3,
            interventionDomains: data.interventionDomains || [],
            schoolsCovered: data.schoolsCovered,
            pedagogicalMethods: data.pedagogicalMethods || [],
            hourlyRateMillimes: data.hourlyRateMillimes ?? 25000,
            onlineVisioPriceMillimes: data.onlineVisioPriceMillimes ?? 35000,
            availability: data.availability,
            bio: data.bio,
          },
          now,
          null,
          false,
        );

        // Auto-activate practitioner persona for seamless dashboard access
        await tx
          .update(personaMembership)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(and(eq(personaMembership.userId, createdUserId), eq(personaMembership.persona, "AVS")));
      } else if (isSpecialist) {
        await completeUserProfileTx(
          tx,
          createdUserId,
          {
            ...common,
            requestedPersona: "SPECIALIST",
            specialty: data.specialty || "Orthophoniste",
            qualification: data.qualification || "Diplôme d'État de Praticien Spécialiste",
            experienceYears: data.experienceYears ?? 3,
            practiceStructure: data.workplaceName,
            workplaceName: data.workplaceName,
            workplaceAddress: data.workplaceAddress,
            licenseOrOrderNumber: data.licenseOrOrderNumber,
            interventionDomains: data.interventionDomains || [],
            inPersonPriceMillimes: data.inPersonPriceMillimes ?? 40000,
            onlineVisioPriceMillimes: data.onlineVisioPriceMillimes ?? 35000,
            bio: data.bio,
          },
          now,
          null,
          false,
        );

        // Auto-activate practitioner persona for seamless dashboard access
        await tx
          .update(personaMembership)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(and(eq(personaMembership.userId, createdUserId), eq(personaMembership.persona, "SPECIALIST")));
      } else if (isOrg) {
        await completeUserProfileTx(
          tx,
          createdUserId,
          {
            ...common,
            requestedPersona: "ORGANIZATION",
            organizationName: data.organizationName || data.institutionName || "Établissement Partenaire ANEI",
            organizationType: data.organizationType || "École privée",
            representativeRole: data.representativeRole || "Directeur / Coordinateur",
          },
          now,
          null,
          false,
        );
        await tx
          .update(personaMembership)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(and(eq(personaMembership.userId, createdUserId), eq(personaMembership.persona, "ORGANIZATION")));
      }

      // 3. Record structured Onboarding Analytics for Super Admin Cockpit
      const recordedPathologies = data.interventionDomains?.length
        ? data.interventionDomains
        : data.childNeeds?.length
        ? data.childNeeds
        : data.interests?.length
        ? data.interests
        : [];

      await tx
        .insert(userOnboardingAnalytics)
        .values({
          userId: createdUserId,
          category: data.category,
          subRole: isStudent
            ? data.subRole
            : isParent
            ? "Parent d'élève"
            : isTeacher
            ? data.discipline || "Enseignant"
            : isOrg
            ? data.organizationType || "Établissement"
            : data.specialty,
          specialty: isSpecialist
            ? (data.specialty || "Orthophoniste")
            : isAvs
            ? "AVS"
            : null,
          governorate: data.governorate,
          city: data.city,
          acquisitionSource: data.acquisitionSource || "DIRECT",
          ageGroup: data.ageGroup,
          pathologies: recordedPathologies,
          lastLoginAt: now,
          lastLoginDevice: request.headers.get("user-agent")?.slice(0, 255) || null,
          lastLoginLocale: data.locale,
          loginCount: 1,
          metadata: {
            schoolsCovered: data.schoolsCovered,
            workplaceName: data.workplaceName,
            licenseNumber: data.licenseOrOrderNumber,
            childCycle: data.childCycle,
            childSchool: data.childSchool,
            teachingCycle: data.teachingCycle,
            organizationName: data.organizationName,
            organizationType: data.organizationType,
            representativeRole: data.representativeRole,
          },
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userOnboardingAnalytics.userId,
          set: {
            category: data.category,
            governorate: data.governorate,
            city: data.city,
            acquisitionSource: data.acquisitionSource || "DIRECT",
            updatedAt: now,
          },
        });
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "PROFILE_PROVISIONING_FAILED", message: msg }, { status: 500 });
  }

  // 4. Record Auth Event
  await recordAuthEvent({
    requestId: getRequestId(request),
    userId: createdUserId,
    eventType: "PROFILE_COMPLETED",
    metadata: {
      action: "REGISTER_WIZARD_COMPLETED",
      category: data.category,
      governorate: data.governorate,
      acquisitionSource: data.acquisitionSource,
    },
  });

  // 5. Intelligent redirect determination - Each category has its own dedicated dashboard
  let redirectUrl = `/${data.locale}/dashboard`;
  if (env.AUTH_REQUIRE_EMAIL_VERIFICATION && !signUpRes.user.emailVerified) {
    redirectUrl = `/${data.locale}/verify-email?email=${encodeURIComponent(data.email)}`;
  } else if (isParent) {
    redirectUrl = `/${data.locale}/parent`;
  } else if (isTeacher) {
    redirectUrl = `/${data.locale}/teacher`;
  } else if (isAvs) {
    redirectUrl = `/${data.locale}/avs/espace`;
  } else if (isSpecialist) {
    redirectUrl = `/${data.locale}/specialist`;
  } else if (isOrg) {
    redirectUrl = `/${data.locale}/organization`;
  } else {
    redirectUrl = `/${data.locale}/dashboard`;
  }

  return NextResponse.json({
    ok: true,
    userId: createdUserId,
    redirectUrl,
    token: signUpRes.token || null,
  });
}
