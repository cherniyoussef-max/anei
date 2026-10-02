import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsProfiles } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  cityFr: z.string().trim().min(2).max(120),
  cityAr: z.string().trim().min(2).max(120),
  governorateFr: z.string().trim().min(2).max(100),
  governorateAr: z.string().trim().min(2).max(100),
  specialtyFr: z.string().trim().min(2).max(180),
  specialtyAr: z.string().trim().min(2).max(180),
  availabilityFr: z.string().trim().min(2).max(180),
  availabilityAr: z.string().trim().min(2).max(180),
  interventionDomains: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  pedagogicalMethods: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  schoolsCoveredFr: z.string().trim().max(300).optional(),
  schoolsCoveredAr: z.string().trim().max(300).optional(),
  hourlyRateTnd: z.coerce.number().min(5).max(300).optional(),
  experienceYears: z.coerce.number().int().min(0).max(50).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(200).optional(),
  bioFr: z.string().trim().max(3000).optional(),
  bioAr: z.string().trim().max(3000).optional(),
  addressFr: z.string().trim().max(200).optional(),
  addressAr: z.string().trim().max(200).optional(),
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [profile] = await db
    .select()
    .from(avsProfiles)
    .where(eq(avsProfiles.userId, session.user.id))
    .limit(1);

  return NextResponse.json({ ok: true, profile: profile ?? null });
}

export async function PATCH(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`avs-profile-update:${requestFingerprint(request)}`, 30, 3600);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(avsProfiles)
    .where(eq(avsProfiles.userId, session.user.id))
    .limit(1);

  const hourlyRateMillimes = parsed.data.hourlyRateTnd !== undefined ? Math.round(parsed.data.hourlyRateTnd * 1000) : undefined;

  const dataToSave = {
    displayName: parsed.data.displayName || session.user.name,
    cityFr: parsed.data.cityFr,
    cityAr: parsed.data.cityAr,
    governorateFr: parsed.data.governorateFr,
    governorateAr: parsed.data.governorateAr,
    specialtyFr: parsed.data.specialtyFr,
    specialtyAr: parsed.data.specialtyAr,
    availabilityFr: parsed.data.availabilityFr,
    availabilityAr: parsed.data.availabilityAr,
    interventionDomains: parsed.data.interventionDomains,
    pedagogicalMethods: parsed.data.pedagogicalMethods,
    schoolsCoveredFr: parsed.data.schoolsCoveredFr ?? "",
    schoolsCoveredAr: parsed.data.schoolsCoveredAr ?? "",
    hourlyRateMillimes: hourlyRateMillimes ?? 25000,
    experienceYears: parsed.data.experienceYears ?? 3,
    phone: parsed.data.phone || null,
    email: parsed.data.email || session.user.email,
    bioFr: parsed.data.bioFr ?? "",
    bioAr: parsed.data.bioAr ?? "",
    addressFr: parsed.data.addressFr ?? "",
    addressAr: parsed.data.addressAr ?? "",
    updatedAt: new Date(),
  };

  let saved;
  if (existing) {
    [saved] = await db
      .update(avsProfiles)
      .set(dataToSave)
      .where(eq(avsProfiles.id, existing.id))
      .returning();
  } else {
    const slug = (parsed.data.displayName || session.user.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    [saved] = await db
      .insert(avsProfiles)
      .values({
        ...dataToSave,
        userId: session.user.id,
        slug,
        certified: false,
        visible: true,
      })
      .returning();
  }

  return NextResponse.json({ ok: true, profile: saved });
}
