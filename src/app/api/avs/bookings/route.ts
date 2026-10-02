import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const bookingSchema = z.object({
  avsProfileId: z.string().min(1).max(64),
  parentName: z.string().trim().min(2).max(120),
  parentEmail: z.string().trim().email().max(200),
  parentPhone: z.string().trim().min(6).max(30),
  childName: z.string().trim().min(2).max(120),
  childAge: z.coerce.number().int().min(1).max(30).optional(),
  schoolName: z.string().trim().max(160).optional().default(""),
  needDescription: z.string().trim().min(5).max(3000),
  interventionDomain: z.string().trim().max(100).optional().default(""),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  requestedTimeSlot: z.string().trim().min(3).max(50),
  meetingType: z.enum(["IN_PERSON", "ONLINE", "HOME"]).default("IN_PERSON"),
  notes: z.string().trim().max(1000).optional().default(""),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`avs-booking:${requestFingerprint(request)}`, 10, 3600);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Check target AVS profile exists and is visible
  const [profile] = await db
    .select({ id: avsProfiles.id, displayName: avsProfiles.displayName })
    .from(avsProfiles)
    .where(and(eq(avsProfiles.id, parsed.data.avsProfileId), eq(avsProfiles.visible, true)))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ ok: false, error: "AVS_NOT_FOUND" }, { status: 404 });
  }

  // Check if session exists to associate parentUserId
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const parentUserId = session?.user?.id ?? null;

  const [booking] = await db
    .insert(avsBookingRequests)
    .values({
      avsProfileId: parsed.data.avsProfileId,
      parentUserId,
      parentName: parsed.data.parentName,
      parentEmail: parsed.data.parentEmail,
      parentPhone: parsed.data.parentPhone,
      childName: parsed.data.childName,
      childAge: parsed.data.childAge ?? null,
      schoolName: parsed.data.schoolName || null,
      needDescription: parsed.data.needDescription,
      interventionDomain: parsed.data.interventionDomain || null,
      requestedDate: parsed.data.requestedDate,
      requestedTimeSlot: parsed.data.requestedTimeSlot,
      meetingType: parsed.data.meetingType,
      status: "PENDING",
      notes: parsed.data.notes || null,
    })
    .returning();

  return NextResponse.json(
    {
      ok: true,
      booking: {
        id: booking.id,
        avsProfileId: booking.avsProfileId,
        avsName: profile.displayName,
        requestedDate: booking.requestedDate,
        requestedTimeSlot: booking.requestedTimeSlot,
        status: booking.status,
      },
    },
    { status: 201 }
  );
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Check if user is an AVS
  const [avsProfile] = await db
    .select({ id: avsProfiles.id })
    .from(avsProfiles)
    .where(eq(avsProfiles.userId, session.user.id))
    .limit(1);

  if (avsProfile) {
    const requests = await db
      .select()
      .from(avsBookingRequests)
      .where(eq(avsBookingRequests.avsProfileId, avsProfile.id))
      .orderBy(desc(avsBookingRequests.createdAt));

    return NextResponse.json({ ok: true, role: "AVS", requests });
  }

  // Otherwise return parent's requests
  const parentRequests = await db
    .select({
      id: avsBookingRequests.id,
      avsProfileId: avsBookingRequests.avsProfileId,
      avsName: avsProfiles.displayName,
      childName: avsBookingRequests.childName,
      requestedDate: avsBookingRequests.requestedDate,
      requestedTimeSlot: avsBookingRequests.requestedTimeSlot,
      meetingType: avsBookingRequests.meetingType,
      status: avsBookingRequests.status,
      createdAt: avsBookingRequests.createdAt,
    })
    .from(avsBookingRequests)
    .innerJoin(avsProfiles, eq(avsBookingRequests.avsProfileId, avsProfiles.id))
    .where(eq(avsBookingRequests.parentUserId, session.user.id))
    .orderBy(desc(avsBookingRequests.createdAt));

  return NextResponse.json({ ok: true, role: "PARENT", requests: parentRequests });
}
