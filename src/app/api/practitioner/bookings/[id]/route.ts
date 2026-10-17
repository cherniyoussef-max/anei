import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles, auditLogs } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";

const actionSchema = z.object({
  action: z.enum(["CONFIRM", "DECLINE", "COMPLETE"]),
  practitionerNotes: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const rate = await consumeRateLimit(`practitioner-booking-action:${session.user.id}`, 30, 60, { fallbackLimit: 15 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const bookingId = (await params).id;
  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = actionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  // Find booking and practitioner profile
  const [booking] = await db
    .select({
      id: avsBookingRequests.id,
      avsProfileId: avsBookingRequests.avsProfileId,
      status: avsBookingRequests.status,
      escrowStatus: avsBookingRequests.escrowStatus,
      paymentMode: avsBookingRequests.paymentMode,
      amountMillimes: avsBookingRequests.amountMillimes,
      netPractitionerPayoutMillimes: avsBookingRequests.netPractitionerPayoutMillimes,
      profileUserId: avsProfiles.userId,
    })
    .from(avsBookingRequests)
    .innerJoin(avsProfiles, eq(avsBookingRequests.avsProfileId, avsProfiles.id))
    .where(eq(avsBookingRequests.id, bookingId))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  // Authorization: must be the practitioner who owns the profile or an ADMIN
  const isOwner = booking.profileUserId === session.user.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const now = new Date();
  let nextStatus = booking.status;
  let nextEscrowStatus = booking.escrowStatus;
  let escrowReleasedAt: Date | null = null;
  let refundedAt: Date | null = null;

  if (parsed.data.action === "CONFIRM") {
    nextStatus = "CONFIRMED";
  } else if (parsed.data.action === "DECLINE") {
    nextStatus = "DECLINED";
    if (booking.escrowStatus === "HELD_IN_ESCROW") {
      nextEscrowStatus = "REFUNDED";
      refundedAt = now;
    }
  } else if (parsed.data.action === "COMPLETE") {
    nextStatus = "COMPLETED";
    if (booking.escrowStatus === "HELD_IN_ESCROW") {
      nextEscrowStatus = "RELEASED_TO_PRACTITIONER";
      escrowReleasedAt = now;
    }
  }

  const [updated] = await db
    .update(avsBookingRequests)
    .set({
      status: nextStatus,
      escrowStatus: nextEscrowStatus,
      escrowReleasedAt: escrowReleasedAt ?? undefined,
      refundedAt: refundedAt ?? undefined,
      practitionerNotes: parsed.data.practitionerNotes ?? undefined,
      updatedAt: now,
    })
    .where(eq(avsBookingRequests.id, bookingId))
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: `practitioner.booking.${parsed.data.action.toLowerCase()}`,
    entityType: "avs_booking_requests",
    entityId: bookingId,
    metadata: {
      fromStatus: booking.status,
      toStatus: nextStatus,
      escrowStatus: nextEscrowStatus,
      payoutMillimes: booking.netPractitionerPayoutMillimes,
    },
  });

  return NextResponse.json({ ok: true, booking: updated });
}
