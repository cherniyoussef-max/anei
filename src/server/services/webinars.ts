import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  webinars,
  webinarRegistrations,
  notifications,
  user,
  type WebinarRegistrationRow,
} from "@/server/db/schema";
import crypto, { randomUUID } from "node:crypto";
import {
  type WebinarMeetingProvider,
  type WebinarProviderMeta,
  type WebinarFormField,
  WEBINAR_PROVIDERS,
  DEFAULT_WEBINAR_FORM_FIELDS,
  getProviderMeta,
  buildGoogleCalendarUrl,
  generateIcsCalendar,
  generateAccessCode,
  hashAccessCode,
} from "@/lib/webinars";
import { sendWebinarAccessPassMail } from "@/server/services/mailer";
import type { Locale } from "@/types";

export type { WebinarMeetingProvider, WebinarProviderMeta, WebinarFormField };
export {
  WEBINAR_PROVIDERS,
  DEFAULT_WEBINAR_FORM_FIELDS,
  getProviderMeta,
  buildGoogleCalendarUrl,
  generateIcsCalendar,
  generateAccessCode,
};

export interface RegisterWebinarInput {
  webinarId: string;
  userId: string; // Mandatory account requirement
  answers?: Record<string, string>;
  locale?: Locale;
}

export interface WebinarRegistrationResult {
  ok: boolean;
  registrationId?: string;
  status?: string;
  joinToken?: string;
  accessCode?: string | null;
  joinUrl?: string;
  meetingUrl?: string | null;
  directMeetingUrl?: string | null;
  googleCalendarUrl?: string;
  icsDownloadUrl?: string;
  alreadyRegistered?: boolean;
  requiresApproval?: boolean;
  startsAt?: Date;
  provider?: string;
  error?: string;
}

/**
 * Registers an authenticated member for a webinar with submitted custom form answers.
 */
export async function registerWebinarParticipant(
  input: RegisterWebinarInput,
): Promise<WebinarRegistrationResult> {
  if (!input.userId) {
    return { ok: false, error: "ACCOUNT_REQUIRED" };
  }

  const [webinar] = await db
    .select()
    .from(webinars)
    .where(eq(webinars.id, input.webinarId))
    .limit(1);

  if (!webinar || !webinar.published) {
    return { ok: false, error: "WEBINAR_NOT_FOUND" };
  }

  // Check existing registration
  const [existingRegistration] = await db
    .select()
    .from(webinarRegistrations)
    .where(
      and(
        eq(webinarRegistrations.webinarId, webinar.id),
        eq(webinarRegistrations.userId, input.userId),
      ),
    )
    .limit(1);

  if (existingRegistration) {
    const isAccepted = existingRegistration.status === "ACCEPTED" || existingRegistration.status === "ATTENDED";
    const joinUrl = `/api/webinars/${webinar.id}/join?token=${existingRegistration.joinToken}`;
    const icsDownloadUrl = `/api/webinars/${webinar.id}/calendar?token=${existingRegistration.joinToken}`;
    const googleCalendarUrl = buildGoogleCalendarUrl({
      title: webinar.titleFr,
      description: webinar.descriptionFr,
      startsAt: webinar.startsAt,
      durationMinutes: webinar.durationMinutes,
      meetingUrl: webinar.meetingUrl,
    });

    return {
      ok: true,
      registrationId: existingRegistration.id,
      status: existingRegistration.status,
      joinToken: existingRegistration.joinToken || undefined,
      accessCode: existingRegistration.accessCode,
      joinUrl,
      meetingUrl: isAccepted && webinar.meetingUrl ? joinUrl : null,
      directMeetingUrl: isAccepted ? webinar.meetingUrl : null,
      googleCalendarUrl,
      icsDownloadUrl,
      alreadyRegistered: true,
      requiresApproval: existingRegistration.status === "PENDING_APPROVAL",
      startsAt: webinar.startsAt,
      provider: webinar.meetingProvider,
    };
  }

  // Check capacity
  if (webinar.maxParticipants && webinar.maxParticipants > 0) {
    const [{ count: currentCount }] = await db
      .select({ count: count() })
      .from(webinarRegistrations)
      .where(eq(webinarRegistrations.webinarId, webinar.id));

    if (currentCount >= webinar.maxParticipants) {
      return { ok: false, error: "WEBINAR_FULL" };
    }
  }

  const joinToken = randomUUID();
  const rawAccessCode = generateAccessCode();
  const hashedAccessCode = hashAccessCode(rawAccessCode);
  const requiresApproval = webinar.requireApproval !== false;
  const initialStatus = requiresApproval ? "PENDING_APPROVAL" : "ACCEPTED";

  const [inserted] = await db
    .insert(webinarRegistrations)
    .values({
      webinarId: webinar.id,
      userId: input.userId,
      answers: input.answers || {},
      joinToken,
      accessCode: !requiresApproval ? hashedAccessCode : null,
      accessCodeVersion: 2,
      status: initialStatus,
    })
    .returning();

  const joinUrl = `/api/webinars/${webinar.id}/join?token=${joinToken}`;
  const icsDownloadUrl = `/api/webinars/${webinar.id}/calendar?token=${joinToken}`;
  const googleCalendarUrl = buildGoogleCalendarUrl({
    title: webinar.titleFr,
    description: webinar.descriptionFr,
    startsAt: webinar.startsAt,
    durationMinutes: webinar.durationMinutes,
    meetingUrl: webinar.meetingUrl,
  });

  // If auto-accepted, send email immediately
  if (!requiresApproval) {
    const [userRow] = await db.select().from(user).where(eq(user.id, input.userId)).limit(1);
    if (userRow) {
      await sendWebinarAccessPassMail({
        name: userRow.name || userRow.email,
        email: userRow.email,
        webinarTitle: webinar.titleFr,
        startsAt: webinar.startsAt,
        meetingProvider: webinar.meetingProvider,
        accessCode: rawAccessCode,
        joinUrl: `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}${joinUrl}`,
        locale: input.locale,
      }).catch(() => {
        // Non-blocking mail failure in dev/staging
      });
    }
  }

  return {
    ok: true,
    registrationId: inserted.id,
    status: initialStatus,
    joinToken,
    accessCode: !requiresApproval ? rawAccessCode : null,
    joinUrl,
    meetingUrl: !requiresApproval && webinar.meetingUrl ? joinUrl : null,
    directMeetingUrl: !requiresApproval ? webinar.meetingUrl : null,
    googleCalendarUrl,
    icsDownloadUrl,
    alreadyRegistered: false,
    requiresApproval,
    startsAt: webinar.startsAt,
    provider: webinar.meetingProvider,
  };
}

/**
 * Admin action: approves a webinar registration, creates in-platform notification,
 * and emails the unique one-time access code to the user.
 */
export async function approveWebinarRegistration(input: {
  registrationId: string;
  actorAdminId: string;
  locale?: Locale;
}) {
  const [row] = await db
    .select({
      regId: webinarRegistrations.id,
      webinarId: webinarRegistrations.webinarId,
      userId: webinarRegistrations.userId,
      accessCode: webinarRegistrations.accessCode,
      joinToken: webinarRegistrations.joinToken,
      status: webinarRegistrations.status,
      webinarTitleFr: webinars.titleFr,
      webinarTitleAr: webinars.titleAr,
      webinarSlug: webinars.slug,
      meetingProvider: webinars.meetingProvider,
      meetingUrl: webinars.meetingUrl,
      startsAt: webinars.startsAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(webinarRegistrations)
    .innerJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
    .innerJoin(user, eq(webinarRegistrations.userId, user.id))
    .where(eq(webinarRegistrations.id, input.registrationId))
    .limit(1);

  if (!row) {
    return { ok: false, error: "REGISTRATION_NOT_FOUND" };
  }

  const rawAccessCode = generateAccessCode();
  const hashedAccessCode = hashAccessCode(rawAccessCode);
  const joinToken = row.joinToken || randomUUID();

  await db
    .update(webinarRegistrations)
    .set({
      status: "ACCEPTED",
      accessCode: hashedAccessCode,
      accessCodeVersion: 2,
      joinToken,
    })
    .where(eq(webinarRegistrations.id, row.regId));

  const ar = input.locale === "ar";
  const providerMeta = getProviderMeta(row.meetingProvider);
  const providerLabel = ar ? providerMeta.nameAr : providerMeta.name;
  const isInPerson = providerMeta.id === "in_person";
  const appBaseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const joinUrl = `${appBaseUrl}/api/webinars/${row.webinarId}/join?code=${rawAccessCode}`;

  // 1. Create in-platform notification
  if (row.userId) {
    const notifBody = isInPerson
      ? ar
        ? `رمز الدخول الخاص بك: ${rawAccessCode}. الحضور في المكان المحدد للدورة.`
        : `Votre code d'accès unique : ${rawAccessCode}. Session en présentiel au lieu indiqué.`
      : ar
        ? `رمز الدخول الخاص بك: ${rawAccessCode}. يمكنك الانضمام مباشرة إلى الجلسة عبر ${providerLabel}.`
        : `Votre code d'accès unique : ${rawAccessCode}. Cliquez pour rejoindre la session sur ${providerLabel}.`;

    await db.insert(notifications).values({
      userId: row.userId,
      type: "webinar_access_granted",
      title: ar ? "تم تأكيد تسجيلك في الندوة" : "Votre place au webinaire est validée !",
      body: notifBody,
      href: `/${input.locale || "fr"}/webinaires/${row.webinarSlug}?code=${rawAccessCode}`,
      read: false,
    });
  }

  // 2. Dispatch official email with unique access code
  if (row.userEmail) {
    await sendWebinarAccessPassMail({
      name: row.userName || row.userEmail,
      email: row.userEmail,
      webinarTitle: ar ? row.webinarTitleAr : row.webinarTitleFr,
      startsAt: row.startsAt,
      meetingProvider: row.meetingProvider,
      accessCode: rawAccessCode,
      joinUrl,
      locale: input.locale,
    }).catch(() => {
      // Non-blocking mail fallback
    });
  }

  return {
    ok: true,
    registrationId: row.regId,
    status: "ACCEPTED",
    accessCode: rawAccessCode,
    joinUrl,
  };
}

/**
 * Admin query: list all registrations with user profiles and custom form answers.
 */
export async function getWebinarRegistrationsAdmin(webinarId: string) {
  const rows = await db
    .select({
      id: webinarRegistrations.id,
      userId: webinarRegistrations.userId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      userProfileType: user.profileType,
      status: webinarRegistrations.status,
      answers: webinarRegistrations.answers,
      accessCode: webinarRegistrations.accessCode,
      joinToken: webinarRegistrations.joinToken,
      joinedAt: webinarRegistrations.joinedAt,
      registeredAt: webinarRegistrations.registeredAt,
    })
    .from(webinarRegistrations)
    .leftJoin(user, eq(webinarRegistrations.userId, user.id))
    .where(eq(webinarRegistrations.webinarId, webinarId))
    .orderBy(desc(webinarRegistrations.registeredAt));

  return rows;
}

/**
 * Tracks webinar join via unique access code or join token.
 */
export type WebinarJoinErrorCode =
  | "WEBINAR_NOT_FOUND"
  | "REGISTRATION_REQUIRED"
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "CANCELLED"
  | "UNAUTHORIZED"
  | "ACCESS_CODE_EXPIRED";

export interface TrackWebinarJoinResult {
  ok: boolean;
  meetingUrl: string | null;
  replayUrl: string | null;
  location?: string | null;
  provider?: string | null;
  title: string;
  error?: WebinarJoinErrorCode;
}

/**
 * Tracks webinar join via unique access code or join token with strict access control.
 * Never returns meetingUrl or replayUrl unless registration is confirmed and valid.
 */
export async function trackWebinarJoin(input: {
  webinarId: string;
  accessCode?: string | null;
  joinToken?: string | null;
  userId?: string | null;
}): Promise<TrackWebinarJoinResult> {
  const [webinar] = await db
    .select()
    .from(webinars)
    .where(eq(webinars.id, input.webinarId))
    .limit(1);

  if (!webinar || !webinar.published) {
    return { ok: false, meetingUrl: null, replayUrl: null, title: "", error: "WEBINAR_NOT_FOUND" };
  }

  // Check code/token expiry:
  // Webinar end time + replay window (72 hours after duration ends). After that, reject with ACCESS_CODE_EXPIRED.
  const startsAt = webinar.startsAt;
  const durationMinutes = webinar.durationMinutes || 60;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
  const expiryWindowMs = 72 * 60 * 60 * 1000; // 72 hours
  const expiresAt = new Date(endsAt.getTime() + expiryWindowMs);

  const now = new Date();
  if (now > expiresAt) {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "ACCESS_CODE_EXPIRED",
    };
  }

  // Find registration strictly bound to this webinar
  let reg: WebinarRegistrationRow | undefined;
  if (input.accessCode && input.accessCode.trim()) {
    const rawNormalized = input.accessCode.trim().toUpperCase();
    const hashed = hashAccessCode(rawNormalized).toLowerCase();

    const candidates = await db
      .select()
      .from(webinarRegistrations)
      .where(
        and(
          eq(webinarRegistrations.webinarId, webinar.id),
          or(
            eq(sql`lower(${webinarRegistrations.accessCode})`, hashed),
            eq(sql`upper(${webinarRegistrations.accessCode})`, rawNormalized),
          ),
        ),
      )
      .limit(2);

    for (const cand of candidates) {
      if (!cand.accessCode) continue;
      const stored = cand.accessCode.trim();
      let matches = false;
      if (stored.length === hashed.length) {
        if (crypto.timingSafeEqual(Buffer.from(stored.toLowerCase(), "utf-8"), Buffer.from(hashed, "utf-8"))) {
          matches = true;
        }
      } else if (stored.length === rawNormalized.length) {
        if (crypto.timingSafeEqual(Buffer.from(stored.toUpperCase(), "utf-8"), Buffer.from(rawNormalized, "utf-8"))) {
          matches = true;
        }
      }
      if (matches) {
        reg = cand;
        break;
      }
    }
  } else if (input.joinToken && input.joinToken.trim()) {
    const [found] = await db
      .select()
      .from(webinarRegistrations)
      .where(
        and(
          eq(webinarRegistrations.webinarId, webinar.id),
          eq(webinarRegistrations.joinToken, input.joinToken.trim()),
        ),
      )
      .limit(1);
    reg = found;
  } else if (input.userId && input.userId.trim()) {
    const [found] = await db
      .select()
      .from(webinarRegistrations)
      .where(
        and(
          eq(webinarRegistrations.webinarId, webinar.id),
          eq(webinarRegistrations.userId, input.userId.trim()),
        ),
      )
      .limit(1);
    reg = found;
  }

  // Registration requirement: must have a registration row for this webinar
  if (!reg) {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "REGISTRATION_REQUIRED",
    };
  }

  // Legacy access code version 1 enforcement: legacy pre-0035 codes are expired
  if (reg.accessCodeVersion === 1) {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "ACCESS_CODE_EXPIRED",
    };
  }

  // User binding check: if an authenticated session user is provided and registration has a userId,
  // ensure the authenticated user owns this registration (prevents User A using User B's token)
  if (input.userId && reg.userId && input.userId.trim() !== reg.userId) {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "UNAUTHORIZED",
    };
  }

  // Lifecycle status checks: revocation enforcement
  if (reg.status === "PENDING_APPROVAL") {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "PENDING_APPROVAL",
    };
  }

  if (reg.status === "REJECTED") {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "REJECTED",
    };
  }

  if (reg.status === "CANCELLED") {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "CANCELLED",
    };
  }

  const isConfirmed =
    reg.status === "ACCEPTED" ||
    reg.status === "ATTENDED";

  if (!isConfirmed) {
    return {
      ok: false,
      meetingUrl: null,
      replayUrl: null,
      title: webinar.titleFr,
      error: "REGISTRATION_REQUIRED",
    };
  }

  // Mark attendance on first access
  if (reg.status !== "ATTENDED") {
    await db
      .update(webinarRegistrations)
      .set({
        joinedAt: new Date(),
        status: "ATTENDED",
      })
      .where(eq(webinarRegistrations.id, reg.id));
  }

  const isInPerson = webinar.meetingProvider === "in_person";

  return {
    ok: true,
    meetingUrl: isInPerson ? null : webinar.meetingUrl,
    replayUrl: webinar.replayUrl,
    location: webinar.location,
    provider: webinar.meetingProvider,
    title: webinar.titleFr,
  };
}

/**
 * Returns webinar attendance and registration statistics.
 */
export async function getWebinarStats(webinarId: string) {
  const [stats] = await db
    .select({
      total: count(),
      attended: sql<number>`count(*) filter (where ${webinarRegistrations.status} = 'ATTENDED' or ${webinarRegistrations.joinedAt} is not null)`,
      pending: sql<number>`count(*) filter (where ${webinarRegistrations.status} = 'PENDING_APPROVAL')`,
      accepted: sql<number>`count(*) filter (where ${webinarRegistrations.status} = 'ACCEPTED')`,
      members: sql<number>`count(*) filter (where ${webinarRegistrations.userId} is not null)`,
    })
    .from(webinarRegistrations)
    .where(eq(webinarRegistrations.webinarId, webinarId));

  return {
    total: Number(stats?.total ?? 0),
    attended: Number(stats?.attended ?? 0),
    pending: Number(stats?.pending ?? 0),
    accepted: Number(stats?.accepted ?? 0),
    members: Number(stats?.members ?? 0),
  };
}
