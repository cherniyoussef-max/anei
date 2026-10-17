import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsProfiles, auditLogs } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";

const profileUpdateSchema = z.object({
  contactPhone: z.string().max(30).optional().nullable(),
  whatsappPhone: z.string().max(30).optional().nullable(),
  showPhonePublicly: z.boolean().optional(),
  inPersonPriceMillimes: z.number().int().min(0).max(500000).optional(),
  onlineVisioPriceMillimes: z.number().int().min(0).max(500000).optional(),
  workplaceName: z.string().max(150).optional().nullable(),
  workplaceAddress: z.string().max(250).optional().nullable(),
  cityFr: z.string().max(100).optional(),
  cityAr: z.string().max(100).optional(),
  governorateFr: z.string().max(100).optional(),
  governorateAr: z.string().max(100).optional(),
  bioFr: z.string().max(3000).optional(),
  bioAr: z.string().max(3000).optional(),
});

export async function PATCH(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (await isImpersonationActive(await headers())) {
    return NextResponse.json(
      { ok: false, error: "MUTATION_BLOCKED_IN_IMPERSONATION" },
      { status: 403 }
    );
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = profileUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Find practitioner's profile
  const [profile] = await db
    .select({ id: avsProfiles.id })
    .from(avsProfiles)
    .where(eq(avsProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_NOT_FOUND", message: "Aucun profil praticien associé à ce compte." },
      { status: 404 }
    );
  }

  const data = parsed.data;
  const [updated] = await db
    .update(avsProfiles)
    .set({
      contactPhone: data.contactPhone !== undefined ? data.contactPhone : undefined,
      whatsappPhone: data.whatsappPhone !== undefined ? data.whatsappPhone : undefined,
      showPhonePublicly: data.showPhonePublicly !== undefined ? data.showPhonePublicly : undefined,
      inPersonPriceMillimes: data.inPersonPriceMillimes !== undefined ? data.inPersonPriceMillimes : undefined,
      onlineVisioPriceMillimes: data.onlineVisioPriceMillimes !== undefined ? data.onlineVisioPriceMillimes : undefined,
      workplaceName: data.workplaceName !== undefined ? data.workplaceName : undefined,
      workplaceAddress: data.workplaceAddress !== undefined ? data.workplaceAddress : undefined,
      cityFr: data.cityFr !== undefined ? data.cityFr : undefined,
      cityAr: data.cityAr !== undefined ? data.cityAr : undefined,
      governorateFr: data.governorateFr !== undefined ? data.governorateFr : undefined,
      governorateAr: data.governorateAr !== undefined ? data.governorateAr : undefined,
      bioFr: data.bioFr !== undefined ? data.bioFr : undefined,
      bioAr: data.bioAr !== undefined ? data.bioAr : undefined,
      updatedAt: new Date(),
    })
    .where(eq(avsProfiles.id, profile.id))
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "practitioner.profile.update",
    entityType: "avs_profiles",
    entityId: profile.id,
    metadata: { updatedFields: Object.keys(data) },
  });

  return NextResponse.json({ ok: true, profile: updated });
}
