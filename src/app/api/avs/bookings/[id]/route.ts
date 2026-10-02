import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const updateSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DECLINED", "COMPLETED"]),
  notes: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`avs-booking-update:${requestFingerprint(request)}`, 30, 3600);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const [booking] = await db
    .select()
    .from(avsBookingRequests)
    .where(eq(avsBookingRequests.id, id))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  // Check authorization: must be admin or the assigned AVS
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (!isAdmin) {
    const [ownedProfile] = await db
      .select({ id: avsProfiles.id })
      .from(avsProfiles)
      .where(and(eq(avsProfiles.id, booking.avsProfileId), eq(avsProfiles.userId, session.user.id)))
      .limit(1);

    if (!ownedProfile) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const [updated] = await db
    .update(avsBookingRequests)
    .set({
      status: parsed.data.status,
      notes: parsed.data.notes !== undefined ? parsed.data.notes : booking.notes,
      updatedAt: new Date(),
    })
    .where(eq(avsBookingRequests.id, id))
    .returning();

  return NextResponse.json({ ok: true, booking: updated });
}
