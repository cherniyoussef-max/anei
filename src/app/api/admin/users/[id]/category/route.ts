import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { db } from "@/server/db";
import { auditLogs, avsProfiles, personaMembership, user, userProfile } from "@/server/db/schema";
import { invalidateAdminUserCaches } from "@/server/cache/admin-users";

const categorySchema = z.object({
  category: z.enum(["LEARNER", "AVS", "SPECIALIST"]),
  specialty: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
});

export async function PATCH(
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

  const targetUserId = (await params).id;
  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = categorySchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { category, specialty, contactPhone } = parsed.data;
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    // 1. Verify target user exists
    const [targetUser] = await tx
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        profileType: user.profileType,
        professionalPostStatus: user.professionalPostStatus,
      })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return { kind: "not_found" as const };
    }

    const [targetProfile] = await tx
      .select({
        phoneNumber: userProfile.phoneNumber,
        city: userProfile.city,
        governorate: userProfile.governorate,
      })
      .from(userProfile)
      .where(eq(userProfile.userId, targetUserId))
      .limit(1);

    const effectivePhone = contactPhone || targetProfile?.phoneNumber || null;
    const displayName = targetUser.name || "Utilisateur ANEI";
    const slugBase = displayName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const [existingAvs] = await tx
      .select({ id: avsProfiles.id, contactPhone: avsProfiles.contactPhone, category: avsProfiles.category, specialtyFr: avsProfiles.specialtyFr })
      .from(avsProfiles)
      .where(eq(avsProfiles.userId, targetUserId))
      .limit(1);

    if (category === "LEARNER") {
      // Demote to Learner: profileType STUDENT, professionalPostStatus LEARNER_ONLY, hide public directory profile
      await tx
        .update(user)
        .set({
          profileType: "STUDENT",
          professionalPostStatus: "LEARNER_ONLY",
          updatedAt: now,
        })
        .where(eq(user.id, targetUserId));

      if (existingAvs) {
        await tx
          .update(avsProfiles)
          .set({
            visible: false,
            updatedAt: now,
          })
          .where(eq(avsProfiles.id, existingAvs.id));
      }
    } else if (category === "AVS") {
      // Promote / Switch to AVS: profileType AVS, professionalPostStatus APPROVED_AVS, activate directory profile
      await tx
        .update(user)
        .set({
          profileType: "AVS",
          professionalPostStatus: "APPROVED_AVS",
          updatedAt: now,
        })
        .where(eq(user.id, targetUserId));

      // Ensure AVS persona membership
      const [existingMembership] = await tx
        .select({ id: personaMembership.id })
        .from(personaMembership)
        .where(eq(personaMembership.userId, targetUserId))
        .limit(1);

      if (existingMembership) {
        await tx
          .update(personaMembership)
          .set({ persona: "AVS", status: "ACTIVE", updatedAt: now })
          .where(eq(personaMembership.id, existingMembership.id));
      } else {
        await tx.insert(personaMembership).values({
          userId: targetUserId,
          persona: "AVS",
          status: "ACTIVE",
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (existingAvs) {
        await tx
          .update(avsProfiles)
          .set({
            displayName,
            directoryType: "AVS",
            category: "AVS",
            specialtyFr: "Accompagnant de Vie Scolaire (AVS)",
            specialtyAr: "مرافق حياة مدرسية",
            contactPhone: effectivePhone || existingAvs.contactPhone,
            phone: effectivePhone || existingAvs.contactPhone,
            certified: true,
            visible: true,
            updatedAt: now,
          })
          .where(eq(avsProfiles.id, existingAvs.id));
      } else {
        await tx.insert(avsProfiles).values({
          userId: targetUserId,
          displayName,
          slug: `${slugBase}-${targetUserId.slice(0, 6)}`,
          directoryType: "AVS",
          category: "AVS",
          cityFr: targetProfile?.city || "Tunis",
          cityAr: targetProfile?.city || "تونس",
          governorateFr: targetProfile?.governorate || "Tunis",
          governorateAr: targetProfile?.governorate || "تونس",
          specialtyFr: "Accompagnant de Vie Scolaire (AVS)",
          specialtyAr: "مرافق حياة مدرسية",
          contactPhone: effectivePhone,
          phone: effectivePhone,
          certified: true,
          visible: true,
          hourlyRateMillimes: 25000,
          availabilityFr: "Disponible (Sur rendez-vous)",
          availabilityAr: "متاح (بموعد مسبق)",
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (category === "SPECIALIST") {
      // Promote / Switch to Specialist: profileType SPECIALIST, professionalPostStatus APPROVED_SPECIALIST
      const resolvedSpec = specialty || existingAvs?.category || "ORTHOPHONIE";
      await tx
        .update(user)
        .set({
          profileType: "SPECIALIST",
          professionalPostStatus: "APPROVED_SPECIALIST",
          updatedAt: now,
        })
        .where(eq(user.id, targetUserId));

      // Ensure SPECIALIST persona membership
      const [existingMembership] = await tx
        .select({ id: personaMembership.id })
        .from(personaMembership)
        .where(eq(personaMembership.userId, targetUserId))
        .limit(1);

      if (existingMembership) {
        await tx
          .update(personaMembership)
          .set({ persona: "SPECIALIST", status: "ACTIVE", updatedAt: now })
          .where(eq(personaMembership.id, existingMembership.id));
      } else {
        await tx.insert(personaMembership).values({
          userId: targetUserId,
          persona: "SPECIALIST",
          status: "ACTIVE",
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (existingAvs) {
        await tx
          .update(avsProfiles)
          .set({
            displayName,
            directoryType: "SPECIALIST",
            category: resolvedSpec,
            specialtyFr: specialty || existingAvs.specialtyFr || "Orthophonie",
            specialtyAr: specialty || existingAvs.specialtyFr || "تقويم النطق والتخاطب",
            contactPhone: effectivePhone || existingAvs.contactPhone,
            phone: effectivePhone || existingAvs.contactPhone,
            certified: true,
            visible: true,
            updatedAt: now,
          })
          .where(eq(avsProfiles.id, existingAvs.id));
      } else {
        await tx.insert(avsProfiles).values({
          userId: targetUserId,
          displayName,
          slug: `${slugBase}-${targetUserId.slice(0, 6)}`,
          directoryType: "SPECIALIST",
          category: resolvedSpec,
          cityFr: targetProfile?.city || "Tunis",
          cityAr: targetProfile?.city || "تونس",
          governorateFr: targetProfile?.governorate || "Tunis",
          governorateAr: targetProfile?.governorate || "تونس",
          specialtyFr: specialty || "Orthophonie",
          specialtyAr: specialty || "تقويم النطق والتخاطب",
          contactPhone: effectivePhone,
          phone: effectivePhone,
          certified: true,
          visible: true,
          inPersonPriceMillimes: 40000,
          onlineVisioPriceMillimes: 35000,
          availabilityFr: "Disponible (Sur rendez-vous)",
          availabilityAr: "متاح (بموعد مسبق)",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await tx.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "user.category.update",
      entityType: "user",
      entityId: targetUserId,
      metadata: {
        fromProfileType: targetUser.profileType,
        fromPostStatus: targetUser.professionalPostStatus,
        toCategory: category,
        specialty,
      },
    });

    return { kind: "ok" as const };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  await invalidateAdminUserCaches(targetUserId);

  return NextResponse.json({ ok: true, category });
}
