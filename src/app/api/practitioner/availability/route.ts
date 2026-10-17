import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsProfiles, auditLogs } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const availabilitySchema = z.object({
  availabilityStatusLabel: z.enum([
    "IMMEDIATE_FULL_TIME",
    "WEEKDAYS",
    "WEEKENDS_AND_EVENINGS",
    "UNAVAILABLE",
  ]).default("IMMEDIATE_FULL_TIME"),
  acceptedModalities: z.enum(["BOTH", "IN_PERSON_ONLY", "ONLINE_ONLY"]).default("BOTH"),
  availableLocationsText: z.string().max(500).default(""),
  weeklySchedule: z.record(
    z.string(),
    z.object({
      enabled: z.boolean(),
      slots: z.array(z.string().trim().regex(/^\d{1,2}:\d{2}$/)).max(24),
    })
  ),
  contactPhone: z.string().max(30).optional().nullable(),
  whatsappPhone: z.string().max(30).optional().nullable(),
});

export async function GET(_request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [profile] = await db
    .select({
      id: avsProfiles.id,
      slug: avsProfiles.slug,
      displayName: avsProfiles.displayName,
      directoryType: avsProfiles.directoryType,
      availabilityStatusLabel: avsProfiles.availabilityStatusLabel,
      acceptedModalities: avsProfiles.acceptedModalities,
      availableLocationsText: avsProfiles.availableLocationsText,
      weeklySchedule: avsProfiles.weeklySchedule,
      contactPhone: avsProfiles.contactPhone,
      whatsappPhone: avsProfiles.whatsappPhone,
      inPersonPriceMillimes: avsProfiles.inPersonPriceMillimes,
      onlineVisioPriceMillimes: avsProfiles.onlineVisioPriceMillimes,
    })
    .from(avsProfiles)
    .where(eq(avsProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ ok: false, error: "PROFILE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, profile });
}

export async function PUT(request: Request) {
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

  const rate = await consumeRateLimit(`practitioner-availability:${session.user.id}`, 20, 60, { fallbackLimit: 10 });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = availabilitySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [profile] = await db
    .select({ id: avsProfiles.id, slug: avsProfiles.slug, directoryType: avsProfiles.directoryType })
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
  const now = new Date();

  const [updated] = await db
    .update(avsProfiles)
    .set({
      availabilityStatusLabel: data.availabilityStatusLabel,
      acceptedModalities: data.acceptedModalities,
      availableLocationsText: data.availableLocationsText,
      weeklySchedule: data.weeklySchedule,
      contactPhone: data.contactPhone !== undefined ? data.contactPhone : undefined,
      whatsappPhone: data.whatsappPhone !== undefined ? data.whatsappPhone : undefined,
      updatedAt: now,
    })
    .where(eq(avsProfiles.id, profile.id))
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "practitioner.availability.update",
    entityType: "avs_profiles",
    entityId: profile.id,
    metadata: {
      availabilityStatusLabel: data.availabilityStatusLabel,
      acceptedModalities: data.acceptedModalities,
      locations: data.availableLocationsText,
    },
  });

  // Revalidate public directory and detail pages in both locales
  try {
    revalidatePath("/fr/avs");
    revalidatePath("/ar/avs");
    revalidatePath("/fr/specialistes");
    revalidatePath("/ar/specialistes");
    if (profile.slug) {
      if (profile.directoryType === "SPECIALIST") {
        revalidatePath(`/fr/specialistes/${profile.slug}`);
        revalidatePath(`/ar/specialistes/${profile.slug}`);
      } else {
        revalidatePath(`/fr/avs/${profile.slug}`);
        revalidatePath(`/ar/avs/${profile.slug}`);
      }
    }
  } catch {
    // Non-fatal if revalidation fails in worker context
  }

  return NextResponse.json({ ok: true, profile: updated });
}
