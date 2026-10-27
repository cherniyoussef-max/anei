import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles, liveSessions, user } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { sendBookingEscrowNotification, sendPractitionerNewBookingAlert } from "@/server/services/mailer";
import { logger } from "@/server/security/logger";

const bookingSchema = z.object({
  avsProfileId: z.string().min(1).max(64),
  parentName: z.string().trim().min(2).max(120).optional(),
  parentEmail: z.string().trim().email().max(200).optional(),
  parentPhone: z.string().trim().min(6).max(30),
  parentLocation: z.string().trim().max(120).optional(),
  childName: z.string().trim().min(2).max(120),
  childAge: z.coerce.number().int().min(1).max(30).optional(),
  schoolName: z.string().trim().max(160).optional().default(""),
  needDescription: z.string().trim().min(5).max(3000),
  interventionDomain: z.string().trim().max(100).optional().default(""),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  requestedTimeSlot: z.string().trim().min(3).max(50),
  meetingType: z.enum(["IN_PERSON", "ONLINE", "HOME", "ONLINE_VISIO"]).default("IN_PERSON"),
  notes: z.string().trim().max(1000).optional().default(""),
  paymentMethod: z.enum(["CARD_ESCROW", "FLOUCI", "ESCROW_SIMULATION", "PAY_ON_SITE"]).default("CARD_ESCROW"),
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

  // Check target AVS or Specialist profile exists and is visible
  const [profile] = await db
    .select({
      id: avsProfiles.id,
      userId: avsProfiles.userId,
      displayName: avsProfiles.displayName,
      directoryType: avsProfiles.directoryType,
      category: avsProfiles.category,
      hourlyRateMillimes: avsProfiles.hourlyRateMillimes,
      inPersonPriceMillimes: avsProfiles.inPersonPriceMillimes,
      onlineVisioPriceMillimes: avsProfiles.onlineVisioPriceMillimes,
      consultationDurationMinutes: avsProfiles.consultationDurationMinutes,
      email: avsProfiles.email,
    })
    .from(avsProfiles)
    .where(and(eq(avsProfiles.id, parsed.data.avsProfileId), eq(avsProfiles.visible, true)))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ ok: false, error: "AVS_NOT_FOUND" }, { status: 404 });
  }

  // Prevent double booking on identical practitioner, date and timeslot
  const [existingConflict] = await db
    .select({ id: avsBookingRequests.id })
    .from(avsBookingRequests)
    .where(
      and(
        eq(avsBookingRequests.avsProfileId, parsed.data.avsProfileId),
        eq(avsBookingRequests.requestedDate, parsed.data.requestedDate),
        eq(avsBookingRequests.requestedTimeSlot, parsed.data.requestedTimeSlot),
        inArray(avsBookingRequests.status, ["AWAITING_PRACTITIONER_CONFIRMATION", "PENDING", "CONFIRMED"])
      )
    )
    .limit(1);

  if (existingConflict) {
    return NextResponse.json(
      { ok: false, error: "SLOT_ALREADY_BOOKED", message: "Ce créneau horaire est déjà réservé pour cette date." },
      { status: 409 }
    );
  }

  const isOnline = parsed.data.meetingType === "ONLINE" || parsed.data.meetingType === "ONLINE_VISIO";
  const isSpecialist = profile.directoryType === "SPECIALIST";

  let paymentMode: "PAY_ON_SITE" | "PLATFORM_ESCROW" = "PLATFORM_ESCROW";
  let platformCommissionPercent = 10;
  let platformFeeMillimes = 0;
  let totalAmountMillimes = 0;
  let avsPayoutMillimes = 0;
  let escrowStatus: "NOT_APPLICABLE" | "HELD_IN_ESCROW" | "RELEASED_TO_PRACTITIONER" | "REFUNDED" = "HELD_IN_ESCROW";
  let paymentStatus = "HELD_IN_ESCROW";

  if (!isOnline && (isSpecialist || parsed.data.paymentMethod === "PAY_ON_SITE")) {
    // In-person cabinet: 0% platform fee, paid directly on site
    const baseRate = profile.inPersonPriceMillimes > 0 ? profile.inPersonPriceMillimes : (profile.hourlyRateMillimes > 0 ? profile.hourlyRateMillimes : 40000);
    paymentMode = "PAY_ON_SITE";
    platformCommissionPercent = 0;
    platformFeeMillimes = 0;
    totalAmountMillimes = baseRate;
    avsPayoutMillimes = baseRate;
    escrowStatus = "NOT_APPLICABLE";
    paymentStatus = "PAY_ON_SITE";
  } else if (isOnline) {
    // Online Visio: 15% platform commission for specialists (10% for AVS) under ANEI escrow
    const baseRate = profile.onlineVisioPriceMillimes > 0 ? profile.onlineVisioPriceMillimes : (profile.hourlyRateMillimes > 0 ? profile.hourlyRateMillimes : 35000);
    paymentMode = "PLATFORM_ESCROW";
    platformCommissionPercent = isSpecialist ? 15 : 10;
    platformFeeMillimes = Math.round(baseRate * (platformCommissionPercent / 100));
    totalAmountMillimes = baseRate + platformFeeMillimes;
    avsPayoutMillimes = baseRate;
    escrowStatus = "HELD_IN_ESCROW";
    paymentStatus = "HELD_IN_ESCROW";
  } else {
    // Standard AVS in-person escrow booking (preserves existing escrow workflow)
    const baseRate = profile.hourlyRateMillimes > 0 ? profile.hourlyRateMillimes : 35000;
    paymentMode = "PLATFORM_ESCROW";
    platformCommissionPercent = 10;
    platformFeeMillimes = Math.round(baseRate * 0.10);
    totalAmountMillimes = baseRate + platformFeeMillimes;
    avsPayoutMillimes = baseRate;
    escrowStatus = "HELD_IN_ESCROW";
    paymentStatus = "HELD_IN_ESCROW";
  }

  // Provision Jitsi live session if online
  let liveSessionId: string | null = null;
  if (isOnline) {
    try {
      const meetingCode = `anei-visio-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const [sessionRow] = await db
        .insert(liveSessions)
        .values({
          titleFr: `Téléconsultation - ${profile.displayName} & ${parsed.data.childName}`,
          titleAr: `استشارة عن بعد - ${profile.displayName} و ${parsed.data.childName}`,
          descriptionFr: `Consultation individuelle sécurisée. Praticien : ${profile.displayName}.`,
          descriptionAr: `استشارة فردية مشفرة ومؤمنة مع ${profile.displayName}.`,
          provider: "JITSI",
          externalMeetingUrl: `https://meet.jit.si/${meetingCode}`,
          embedMode: "PORTAL_LAUNCH",
          scope: "COURSE_SPECIFIC",
          status: "SCHEDULED",
          scheduledStartAt: new Date(parsed.data.requestedDate),
          durationMinutes: profile.consultationDurationMinutes || 45,
          createdById: session.user.id,
        })
        .returning({ id: liveSessions.id });
      liveSessionId = sessionRow.id;
    } catch (jitsiErr) {
      logger.error("avs.booking.live_session_provision_error", { error: jitsiErr });
    }
  }

  const escrowRef = `ESC-2026-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const parentName = parsed.data.parentName || session.user.name || "Parent";
  const parentEmail = parsed.data.parentEmail || session.user.email || "";

  let booking: typeof avsBookingRequests.$inferSelect;
  try {
    const [inserted] = await db
      .insert(avsBookingRequests)
      .values({
        avsProfileId: parsed.data.avsProfileId,
        parentUserId: session.user.id,
        parentName,
        parentEmail,
        parentPhone: parsed.data.parentPhone,
        parentLocation: parsed.data.parentLocation || null,
        childName: parsed.data.childName,
        childAge: parsed.data.childAge ?? null,
        schoolName: parsed.data.schoolName || null,
        needDescription: parsed.data.needDescription,
        interventionDomain: parsed.data.interventionDomain || null,
        requestedDate: parsed.data.requestedDate,
        requestedTimeSlot: parsed.data.requestedTimeSlot,
        meetingType: parsed.data.meetingType,
        status: "AWAITING_PRACTITIONER_CONFIRMATION",
        notes: parsed.data.notes || null,
        amountMillimes: totalAmountMillimes,
        platformFeeMillimes,
        avsPayoutMillimes,
        paymentMode,
        platformCommissionPercent,
        netPractitionerPayoutMillimes: avsPayoutMillimes,
        liveSessionId,
        escrowStatus,
        paymentStatus,
        paymentMethod: parsed.data.paymentMethod,
        paymentReference: escrowRef,
        paidAt: new Date(),
      })
      .returning();
    booking = inserted;
  } catch (err: unknown) {
    const dbErr = err as { code?: string; message?: string };
    if (dbErr?.code === "23505" || dbErr?.message?.includes("avs_booking_slot_unique")) {
      return NextResponse.json(
        { ok: false, error: "SLOT_ALREADY_BOOKED", message: "Ce créneau horaire est déjà réservé pour cette date." },
        { status: 409 }
      );
    }
    throw err;
  }

  // 1. Send automatic Notification Alert Email to the Practitioner
  let practitionerEmail = profile.email;
  if (!practitionerEmail && profile.userId) {
    const [pUser] = await db.select({ email: user.email }).from(user).where(eq(user.id, profile.userId)).limit(1);
    if (pUser?.email) practitionerEmail = pUser.email;
  }

  if (practitionerEmail) {
    try {
      await sendPractitionerNewBookingAlert({
        practitionerEmail,
        practitionerName: profile.displayName,
        requesterName: parentName,
        requesterEmail: parentEmail,
        requesterPhone: parsed.data.parentPhone,
        requesterLocation: parsed.data.parentLocation,
        childName: parsed.data.childName,
        childAge: parsed.data.childAge,
        requestedDate: parsed.data.requestedDate,
        requestedTimeSlot: parsed.data.requestedTimeSlot,
        meetingType: parsed.data.meetingType,
        needDescription: parsed.data.needDescription,
        notes: parsed.data.notes,
        bookingId: booking.id,
        locale: parsed.data.locale,
      });
      logger.info("avs.booking.practitioner_alert_sent", { bookingId: booking.id, practitionerEmail });
    } catch (mailErr) {
      logger.error("avs.booking.practitioner_alert_error", { error: mailErr });
    }
  }

  // 2. Send automatic Escrow Confirmation Email to Parent if escrow is active
  if (paymentMode === "PLATFORM_ESCROW") {
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
