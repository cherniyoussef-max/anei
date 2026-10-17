import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { isSudoModeActive } from "@/server/auth/sudo";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { db } from "@/server/db";
import { auditLogs, avsProfiles, practitionerPromotions, user } from "@/server/db/schema";
import { invalidateAdminUserCaches } from "@/server/cache/admin-users";

const promoteSchema = z.object({
  targetDirectoryType: z.enum(["AVS", "SPECIALIST"]),
  targetCategory: z.string().min(2).max(100),
  professionalPostStatus: z.enum([
    "LEARNER_ONLY",
    "CANDIDATE_UNDER_REVIEW",
    "APPROVED_AVS",
    "APPROVED_SPECIALIST",
  ]),
  interviewStatus: z.enum(["NOT_SCHEDULED", "SCHEDULED", "PASSED", "FAILED"]).default("NOT_SCHEDULED"),
  interviewScore: z.number().int().min(0).max(100).optional().nullable(),
  interviewNotes: z.string().max(3000).optional().nullable(),
  interviewScheduledAt: z.string().optional().nullable(),
  qualifyingCourseIds: z.array(z.string()).default([]),
  // Directory profile details
  displayName: z.string().min(2).max(120).optional(),
  cityFr: z.string().max(100).optional().default("Tunis"),
  cityAr: z.string().max(100).optional().default("تونس"),
  governorateFr: z.string().max(100).optional().default("Tunis"),
  governorateAr: z.string().max(100).optional().default("تونس"),
  specialtyFr: z.string().max(120).optional(),
  specialtyAr: z.string().max(120).optional(),
  workplaceName: z.string().max(150).optional().nullable(),
  workplaceAddress: z.string().max(250).optional().nullable(),
  licenseOrOrderNumber: z.string().max(100).optional().nullable(),
  universityDegree: z.string().max(150).optional().nullable(),
  contactPhone: z.string().max(30).optional().nullable(),
  whatsappPhone: z.string().max(30).optional().nullable(),
  showPhonePublicly: z.boolean().default(true),
  inPersonPriceMillimes: z.number().int().min(0).optional().default(40000),
  onlineVisioPriceMillimes: z.number().int().min(0).optional().default(35000),
  consultationDurationMinutes: z.number().int().min(15).max(180).optional().default(45),
  bioFr: z.string().max(3000).optional().default(""),
  bioAr: z.string().max(3000).optional().default(""),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const reqHeaders = await headers();
  if (await isImpersonationActive(reqHeaders)) {
    return NextResponse.json(
      {
        ok: false,
        error: "MUTATION_BLOCKED_IN_IMPERSONATION",
        message: "Action bloquée en mode impersonation (lecture seule stricte).",
      },
      { status: 403 }
    );
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const sudoActive = await isSudoModeActive(request, session.user.id);
  if (!sudoActive) {
    return NextResponse.json(
      {
        ok: false,
        error: "SUDO_REQUIRED",
        message: "Mode Sudo requis : veuillez confirmer votre mot de passe administrateur pour promouvoir un utilisateur.",
      },
      { status: 403 }
    );
  }

  const targetUserId = (await params).id;
  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = promoteSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    // 1. Verify target user exists
    const [targetUser] = await tx
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        professionalPostStatus: user.professionalPostStatus,
      })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return { kind: "not_found" as const };
    }

    const isApproved =
      data.professionalPostStatus === "APPROVED_AVS" ||
      data.professionalPostStatus === "APPROVED_SPECIALIST";

    // 2. Update user professional status
    await tx
      .update(user)
      .set({
        professionalPostStatus: data.professionalPostStatus,
        updatedAt: new Date(),
      })
      .where(eq(user.id, targetUserId));

    // 3. Record practitioner promotion
    const [promo] = await tx
      .insert(practitionerPromotions)
      .values({
        userId: targetUserId,
        targetDirectoryType: data.targetDirectoryType,
        targetCategory: data.targetCategory,
        professionalPostStatus: data.professionalPostStatus,
        interviewStatus: data.interviewStatus,
        interviewNotes: data.interviewNotes || null,
        interviewScore: data.interviewScore ?? null,
        interviewScheduledAt: data.interviewScheduledAt ? new Date(data.interviewScheduledAt) : null,
        qualifyingCourseIds: data.qualifyingCourseIds,
        promotedByAdminId: session.user.id,
        promotedAt: isApproved ? new Date() : null,
      })
      .returning();

    // 4. If approved, create or update professional profile in avs_profiles
    let updatedProfile = null;
    if (isApproved) {
      const [existing] = await tx
        .select({ id: avsProfiles.id })
        .from(avsProfiles)
        .where(eq(avsProfiles.userId, targetUserId))
        .limit(1);

      const displayName = data.displayName || targetUser.name || "Praticien ANEI";
      const slugBase = displayName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const finalSlug = existing ? undefined : `${slugBase}-${targetUserId.slice(0, 6)}`;

      if (existing) {
        [updatedProfile] = await tx
          .update(avsProfiles)
          .set({
            displayName,
            directoryType: data.targetDirectoryType,
            category: data.targetCategory,
            cityFr: data.cityFr,
            cityAr: data.cityAr,
            governorateFr: data.governorateFr,
            governorateAr: data.governorateAr,
            specialtyFr: data.specialtyFr || data.targetCategory,
            specialtyAr: data.specialtyAr || data.targetCategory,
            workplaceName: data.workplaceName || null,
            workplaceAddress: data.workplaceAddress || null,
            licenseOrOrderNumber: data.licenseOrOrderNumber || null,
            universityDegree: data.universityDegree || null,
            contactPhone: data.contactPhone || null,
            whatsappPhone: data.whatsappPhone || null,
            showPhonePublicly: data.showPhonePublicly,
            inPersonPriceMillimes: data.inPersonPriceMillimes,
            onlineVisioPriceMillimes: data.onlineVisioPriceMillimes,
            consultationDurationMinutes: data.consultationDurationMinutes,
            bioFr: data.bioFr,
            bioAr: data.bioAr,
            certified: true,
            visible: true,
            updatedAt: new Date(),
          })
          .where(eq(avsProfiles.id, existing.id))
          .returning();
      } else {
        [updatedProfile] = await tx
          .insert(avsProfiles)
          .values({
            userId: targetUserId,
            displayName,
            slug: finalSlug,
            directoryType: data.targetDirectoryType,
            category: data.targetCategory,
            cityFr: data.cityFr,
            cityAr: data.cityAr,
            governorateFr: data.governorateFr,
            governorateAr: data.governorateAr,
            specialtyFr: data.specialtyFr || data.targetCategory,
            specialtyAr: data.specialtyAr || data.targetCategory,
            workplaceName: data.workplaceName || null,
            workplaceAddress: data.workplaceAddress || null,
            licenseOrOrderNumber: data.licenseOrOrderNumber || null,
            universityDegree: data.universityDegree || null,
            contactPhone: data.contactPhone || null,
            whatsappPhone: data.whatsappPhone || null,
            showPhonePublicly: data.showPhonePublicly,
            inPersonPriceMillimes: data.inPersonPriceMillimes,
            onlineVisioPriceMillimes: data.onlineVisioPriceMillimes,
            consultationDurationMinutes: data.consultationDurationMinutes,
            availabilityFr: "Temps plein (Sur rendez-vous)",
            availabilityAr: "كامل الوقت (بموعد مسبق)",
            bioFr: data.bioFr,
            bioAr: data.bioAr,
            certified: true,
            visible: true,
          })
          .returning();
      }
    }

    // 5. Audit Log
    await tx.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "user.promote_post",
      entityType: "user",
      entityId: targetUserId,
      metadata: {
        from: targetUser.professionalPostStatus,
        to: data.professionalPostStatus,
        targetDirectoryType: data.targetDirectoryType,
        targetCategory: data.targetCategory,
        interviewStatus: data.interviewStatus,
        interviewScore: data.interviewScore,
      },
    });

    return { kind: "ok" as const, promotion: promo, profile: updatedProfile };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  await invalidateAdminUserCaches(targetUserId);

  return NextResponse.json({
    ok: true,
    promotion: result.promotion,
    profile: result.profile,
  });
}
