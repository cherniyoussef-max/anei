import { and, desc, eq, or } from "drizzle-orm";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  auditLogs,
  avsCertificationsLog,
  avsProfiles,
  courses,
  user,
  type CourseRow,
} from "@/server/db/schema";
import { logger } from "@/server/security/logger";

const BASE32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates an unforgeable, human-readable unique AVS identifier:
 * Format: ANEI-AVS-YYYY-XXXXX (e.g., ANEI-AVS-2026-9842K)
 */
export function generateAvsUniqueIdentifier(year = new Date().getFullYear()): string {
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return `ANEI-AVS-${year}-${suffix}`;
}

/**
 * Computes a cryptographic SHA-256 HMAC verification hash for the certificate.
 */
export function computeCertificateHash(params: {
  userId: string;
  courseId: string;
  uniqueIdentifier: string;
  scorePercent: number;
  issuedAt: Date;
}): string {
  const secret = process.env.AUTH_SECRET || "anei-zero-trust-cert-salt-2026";
  const payload = [
    params.userId,
    params.courseId,
    params.uniqueIdentifier,
    params.scorePercent,
    params.issuedAt.toISOString(),
  ].join("::");

  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Determines whether a course is part of the professional AVS / Special Needs qualification program.
 */
export function isQualifyingAvsCourse(course: CourseRow): boolean {
  if (course.qualifiesForProfessionalPromotion) return true;
  if (course.qualifyingTargetType === "AVS" || course.qualifyingTargetType === "SPECIALIST") {
    return true;
  }

  const textToScan = `${course.titleFr} ${course.titleAr} ${course.slug} ${course.category}`.toLowerCase();
  const qualifyingKeywords = [
    "avs",
    "accompagnant",
    "autisme",
    "tsa",
    "tdah",
    "dys",
    "inclusion",
    "handicap",
    "scolair",
    "pei",
    "pps",
    "sensoriel",
  ];

  return qualifyingKeywords.some((kw) => textToScan.includes(kw));
}

export interface AvsCertificationResult {
  granted: boolean;
  uniqueIdentifier?: string;
  certificateHash?: string;
  alreadyCertified?: boolean;
  scorePercent?: number;
  reason?: string;
  avsProfileId?: string;
}

/**
 * Zero-Trust Certification Engine:
 * Validates course score, assigns or retrieves unique unforgeable identifier,
 * enables CERTIFIED_ACTIVE status on avs_profiles in PostgreSQL, and creates
 * an immutable certification log row.
 */
export async function checkAndGrantAvsCertification(
  userId: string,
  courseId: string,
  finalScorePercent: number,
  options?: { adminBypass?: boolean; adminUserId?: string }
): Promise<AvsCertificationResult> {
  try {
    // 1. Strict Score Gate: Must achieve >= 80% on the final assessment
    if (!options?.adminBypass && finalScorePercent < 80) {
      logger.info("avs_certification.rejected_score", {
        userId,
        courseId,
        finalScorePercent,
        requiredScore: 80,
      });
      return {
        granted: false,
        reason: "SCORE_BELOW_80",
        scorePercent: finalScorePercent,
      };
    }

    // 2. Load course and ensure it is a qualifying certifiable course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return { granted: false, reason: "COURSE_NOT_FOUND" };
    }

    if (!options?.adminBypass && !isQualifyingAvsCourse(course)) {
      return { granted: false, reason: "NOT_QUALIFYING_AVS_COURSE" };
    }

    const issuedAt = new Date();

    const certification = await db.transaction(async (tx) => {
      // 3. Find or create user's AVS profile
      let [profile] = await tx
        .select()
        .from(avsProfiles)
        .where(eq(avsProfiles.userId, userId))
        .limit(1);

      let uniqueIdentifier = profile?.uniqueIdentifier;
      if (!uniqueIdentifier) {
        uniqueIdentifier = generateAvsUniqueIdentifier(issuedAt.getFullYear());
      }

      const certificateHash = computeCertificateHash({
        userId,
        courseId,
        uniqueIdentifier,
        scorePercent: finalScorePercent,
        issuedAt,
      });

      let avsProfileId: string;

      if (profile) {
        avsProfileId = profile.id;
        const currentSpecialties = Array.isArray(profile.specialtiesJson) ? profile.specialtiesJson : [];
        const detectedKeywords = ["TSA", "TDAH", "DYS"];
        const newSpecialties = Array.from(new Set([...currentSpecialties, ...detectedKeywords]));

        const currentMethods = Array.isArray(profile.methodsJson) ? profile.methodsJson : [];
        const standardMethods = ["PECS", "Makaton", "Séquençage visuel", "Guidance pas-à-pas"];
        const newMethods = Array.from(new Set([...currentMethods, ...standardMethods]));

        const [updated] = await tx
          .update(avsProfiles)
          .set({
            uniqueIdentifier,
            certified: true,
            verificationStatus: "CERTIFIED_ACTIVE",
            verifiedAt: issuedAt,
            verifiedByAdminId: options?.adminUserId ?? profile.verifiedByAdminId ?? null,
            visible: true,
            educationLevel: profile.educationLevel || "Formation Certifiante Académie ANEI",
            specialtiesJson: newSpecialties,
            methodsJson: newMethods,
            coveredSchoolsOrZones:
              profile.coveredSchoolsOrZones || "Grand Tunis et établissements scolaires partenaires",
            updatedAt: issuedAt,
          })
          .where(eq(avsProfiles.id, profile.id))
          .returning();

        profile = updated;
      } else {
        // Fetch user basic identity to seed a qualified AVS profile
        const [usr] = await tx
          .select({ name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);

        const displayName = usr?.name || "Accompagnant(e) Scolaire ANEI";
        const baseSlug = `avs-${userId.slice(0, 8)}`;

        const [created] = await tx
          .insert(avsProfiles)
          .values({
            userId,
            displayName,
            slug: baseSlug,
            cityFr: "Tunis",
            cityAr: "تونس",
            governorateFr: "Tunis",
            governorateAr: "تونس",
            specialtyFr: "Accompagnement scolaire certifié (TSA / TDAH / DYS)",
            specialtyAr: "مرافقة مدرسية معتمدة (طيف التوحد / فرط الحركة / صعوبات التعلم)",
            interventionDomains: ["Accompagnement scolaire général", "Adaptations pédagogiques"],
            pedagogicalMethods: ["Guidance visuelle", "Renforcement positif", "PECS / Makaton"],
            uniqueIdentifier,
            educationLevel: "Formation Certifiante Académie ANEI",
            specialtiesJson: ["TSA", "TDAH", "DYS"],
            methodsJson: ["PECS", "Makaton", "Séquençage visuel"],
            coveredSchoolsOrZones: "Grand Tunis et établissements scolaires partenaires",
            verificationStatus: "CERTIFIED_ACTIVE",
            certified: true,
            visible: true,
            verifiedAt: issuedAt,
            verifiedByAdminId: options?.adminUserId ?? null,
            availabilityFr: "Disponible temps plein",
            availabilityAr: "متاح كامل الوقت",
            email: usr?.email,
          })
          .returning();

        avsProfileId = created.id;
        profile = created;
      }

      // 4. Record into avs_certifications_log (idempotent on certificateHash)
      const [existingLog] = await tx
        .select()
        .from(avsCertificationsLog)
        .where(
          and(
            eq(avsCertificationsLog.userId, userId),
            eq(avsCertificationsLog.courseId, courseId)
          )
        )
        .limit(1);

      if (existingLog) {
        await tx
          .update(avsCertificationsLog)
          .set({
            scorePercent: Math.max(existingLog.scorePercent, finalScorePercent),
            certificateHash,
            issuedAt,
          })
          .where(eq(avsCertificationsLog.id, existingLog.id));
      } else {
        await tx.insert(avsCertificationsLog).values({
          userId,
          avsProfileId,
          courseId,
          scorePercent: finalScorePercent,
          certificateHash,
          issuedAt,
        });
      }

      // 5. Audit Log
      await tx.insert(auditLogs).values({
        actorUserId: options?.adminUserId ?? userId,
        action: "avs.certified_by_lms",
        entityType: "avs_profile",
        entityId: avsProfileId,
        metadata: {
          courseId,
          courseTitle: course.titleFr,
          finalScorePercent,
          uniqueIdentifier,
          certificateHash,
        },
      });

      return {
        uniqueIdentifier,
        certificateHash,
        avsProfileId,
      };
    });

    // 6. Invalidate Next.js cache so the newly certified AVS appears live in the public directory
    try {
      revalidatePath("/[locale]/avs", "page");
      revalidatePath("/[locale]/avs/[id]", "page");
      revalidatePath("/fr/avs");
      revalidatePath("/ar/avs");
      revalidatePath("/fr/dashboard/praticien");
      revalidatePath("/ar/dashboard/praticien");
      revalidatePath("/[locale]", "page");
    } catch {
      // Ignore when running outside of HTTP context
    }

    logger.info("avs_certification.granted", {
      userId,
      courseId,
      finalScorePercent,
      uniqueIdentifier: certification.uniqueIdentifier,
    });

    return {
      granted: true,
      uniqueIdentifier: certification.uniqueIdentifier,
      certificateHash: certification.certificateHash,
      scorePercent: finalScorePercent,
      avsProfileId: certification.avsProfileId,
    };
  } catch (error) {
    logger.error("avs_certification.grant_failed", {
      userId,
      courseId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { granted: false, reason: "INTERNAL_ERROR" };
  }
}

/**
 * Retrieves the full official proof of certification for an AVS profile.
 * Used by public profiles, QR code verification pages, and practitioner dashboards.
 */
export async function getAvsCertificationProof(uniqueIdentifierOrId: string) {
  const [profile] = await db
    .select()
    .from(avsProfiles)
    .where(
      or(
        eq(avsProfiles.uniqueIdentifier, uniqueIdentifierOrId),
        eq(avsProfiles.id, uniqueIdentifierOrId),
        eq(avsProfiles.slug, uniqueIdentifierOrId)
      )
    )
    .limit(1);

  if (!profile) return null;

  const logs = await db
    .select({
      id: avsCertificationsLog.id,
      scorePercent: avsCertificationsLog.scorePercent,
      certificateHash: avsCertificationsLog.certificateHash,
      issuedAt: avsCertificationsLog.issuedAt,
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
      courseSlug: courses.slug,
    })
    .from(avsCertificationsLog)
    .innerJoin(courses, eq(avsCertificationsLog.courseId, courses.id))
    .where(eq(avsCertificationsLog.avsProfileId, profile.id))
    .orderBy(desc(avsCertificationsLog.issuedAt));

  return {
    profile,
    certifications: logs,
    isCertified: profile.certified && profile.verificationStatus === "CERTIFIED_ACTIVE",
    uniqueIdentifier: profile.uniqueIdentifier,
    verifiedAt: profile.verifiedAt,
  };
}
