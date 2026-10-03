import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { sendBookingEscrowNotification } from "@/server/services/mailer";
import { logger } from "@/server/security/logger";

const bookingSchema = z.object({
  avsProfileId: z.string().min(1).max(64),
  parentName: z.string().trim().min(2).max(120).optional(),
  parentEmail: z.string().trim().email().max(200).optional(),
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
  paymentMethod: z.enum(["CARD_ESCROW", "FLOUCI", "CLICKTOPAY", "ESCROW_SIMULATION"]).default("CARD_ESCROW"),
  locale: z.enum(["fr", "ar", "en"]).default("fr"),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  // Enforce authentication: parent MUST have an account and be logged in
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json(
      {
        ok: false,
        error: "AUTH_REQUIRED",
        message: "Veuillez créer un compte ou vous connecter pour réserver un rendez-vous AVS et sécuriser le paiement sous séquestre.",
      },
      { status: 401 }
    );
  }

  const rate = await consumeRateLimit(`avs-booking:${session.user.id}`, 10, 3600);
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
    .select({
      id: avsProfiles.id,
      displayName: avsProfiles.displayName,
      hourlyRateMillimes: avsProfiles.hourlyRateMillimes,
      email: avsProfiles.email,
    })
    .from(avsProfiles)
    .where(and(eq(avsProfiles.id, parsed.data.avsProfileId), eq(avsProfiles.visible, true)))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ ok: false, error: "AVS_NOT_FOUND" }, { status: 404 });
  }

  // Calculate Third-Party Escrow Payment
  // Standard session rate based on AVS hourly rate (default 35 TND = 35000 millimes)
  const baseRateMillimes = profile.hourlyRateMillimes > 0 ? profile.hourlyRateMillimes : 35000;
  // ANEI 10% platform fee as third-party escrow guarantee
  const platformFeeMillimes = Math.round(baseRateMillimes * 0.10);
  const totalAmountMillimes = baseRateMillimes + platformFeeMillimes;
  const avsPayoutMillimes = baseRateMillimes;

  const escrowRef = `ESC-2026-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const parentName = parsed.data.parentName || session.user.name || "Parent";
  const parentEmail = parsed.data.parentEmail || session.user.email || "";

  const [booking] = await db
    .insert(avsBookingRequests)
    .values({
      avsProfileId: parsed.data.avsProfileId,
      parentUserId: session.user.id,
      parentName,
      parentEmail,
      parentPhone: parsed.data.parentPhone,
      childName: parsed.data.childName,
      childAge: parsed.data.childAge ?? null,
      schoolName: parsed.data.schoolName || null,
      needDescription: parsed.data.needDescription,
      interventionDomain: parsed.data.interventionDomain || null,
      requestedDate: parsed.data.requestedDate,
      requestedTimeSlot: parsed.data.requestedTimeSlot,
      meetingType: parsed.data.meetingType,
      status: "CONFIRMED",
      notes: parsed.data.notes || null,
      amountMillimes: totalAmountMillimes,
      platformFeeMillimes,
      avsPayoutMillimes,
      paymentStatus: "HELD_IN_ESCROW",
      paymentMethod: parsed.data.paymentMethod,
      paymentReference: escrowRef,
      paidAt: new Date(),
    })
    .returning();

  // Send automatic Escrow Confirmation Email to Parent
  try {
    await sendBookingEscrowNotification({
      parentName,
      parentEmail,
      avsName: profile.displayName,
      childName: parsed.data.childName,
      requestedDate: parsed.data.requestedDate,
      requestedTimeSlot: parsed.data.requestedTimeSlot,
      meetingType: parsed.data.meetingType,
      amountTnd: Math.round(totalAmountMillimes / 1000),
      escrowRef,
      locale: parsed.data.locale,
    });
    logger.info("avs.booking.escrow_email_sent", { bookingId: booking.id, escrowRef });
  } catch (mailErr) {
    logger.error("avs.booking.mail_error", { error: mailErr });
  }

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
        escrow: {
          reference: escrowRef,
          amountTnd: totalAmountMillimes / 1000,
          platformFeeTnd: platformFeeMillimes / 1000,
          avsPayoutTnd: avsPayoutMillimes / 1000,
          status: "HELD_IN_ESCROW",
          guarantee: "Garantie Tiers de Confiance ANEI — Fonds sous séquestre sécurisé",
        },
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
      .select({
        id: avsBookingRequests.id,
        parentName: avsBookingRequests.parentName,
        parentEmail: avsBookingRequests.parentEmail,
        parentPhone: avsBookingRequests.parentPhone,
        childName: avsBookingRequests.childName,
        childAge: avsBookingRequests.childAge,
        schoolName: avsBookingRequests.schoolName,
        needDescription: avsBookingRequests.needDescription,
        requestedDate: avsBookingRequests.requestedDate,
        requestedTimeSlot: avsBookingRequests.requestedTimeSlot,
        meetingType: avsBookingRequests.meetingType,
        status: avsBookingRequests.status,
        amountMillimes: avsBookingRequests.amountMillimes,
        platformFeeMillimes: avsBookingRequests.platformFeeMillimes,
        avsPayoutMillimes: avsBookingRequests.avsPayoutMillimes,
        paymentStatus: avsBookingRequests.paymentStatus,
        paymentReference: avsBookingRequests.paymentReference,
        createdAt: avsBookingRequests.createdAt,
      })
      .from(avsBookingRequests)
      .where(eq(avsBookingRequests.avsProfileId, avsProfile.id))
      .orderBy(desc(avsBookingRequests.createdAt));

    return NextResponse.json({ ok: true, role: "AVS", requests });
  }

  // Otherwise return parent's requests with Escrow details
  const parentRequests = await db
    .select({
      id: avsBookingRequests.id,
      avsProfileId: avsBookingRequests.avsProfileId,
      avsName: avsProfiles.displayName,
      avsSpecialty: avsProfiles.specialtyFr,
      childName: avsBookingRequests.childName,
      requestedDate: avsBookingRequests.requestedDate,
      requestedTimeSlot: avsBookingRequests.requestedTimeSlot,
      meetingType: avsBookingRequests.meetingType,
      status: avsBookingRequests.status,
      amountMillimes: avsBookingRequests.amountMillimes,
      platformFeeMillimes: avsBookingRequests.platformFeeMillimes,
      avsPayoutMillimes: avsBookingRequests.avsPayoutMillimes,
      paymentStatus: avsBookingRequests.paymentStatus,
      paymentReference: avsBookingRequests.paymentReference,
      paidAt: avsBookingRequests.paidAt,
      createdAt: avsBookingRequests.createdAt,
    })
    .from(avsBookingRequests)
    .innerJoin(avsProfiles, eq(avsBookingRequests.avsProfileId, avsProfiles.id))
    .where(eq(avsBookingRequests.parentUserId, session.user.id))
    .orderBy(desc(avsBookingRequests.createdAt));

  return NextResponse.json({ ok: true, role: "PARENT", requests: parentRequests });
}
