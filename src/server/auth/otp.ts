import "server-only";
import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  authVerificationChallenge,
  organizationMembership,
  user,
  userProfile,
} from "@/server/db/schema";
import {
  AUTH_OTP_MAX_ATTEMPTS,
  AUTH_OTP_RESEND_COOLDOWN_SECONDS,
  AUTH_OTP_TTL_MINUTES,
  digestEqual,
  generateAuthOtp,
  hashAuthOtp,
} from "@/server/security/auth-otp-crypto";
import { sendMail } from "@/server/services/mailer";
import { enqueueSystemWhatsAppAuthOtp } from "@/server/services/whatsapp";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { recordAuthEvent, type AuthChannel, type AuthPurpose } from "@/server/auth/events";

export type AvailableChannel = {
  channel: AuthChannel;
  destinationMasked: string;
};

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "***";
  const left = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${left}@${domain}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${value.slice(0, 4)} ** *** ${digits.slice(-3)}`;
}

async function resolvePreferredWhatsappOrganization(userId: string) {
  const [row] = await db
    .select({ organizationId: organizationMembership.organizationId })
    .from(organizationMembership)
    .where(and(eq(organizationMembership.userId, userId), eq(organizationMembership.status, "ACTIVE")))
    .limit(1);
  return row?.organizationId ?? null;
}

export async function getAvailableOtpChannels(userId: string): Promise<AvailableChannel[]> {
  const [identity] = await db
    .select({
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: userProfile.phoneNumber,
      phoneVerifiedAt: userProfile.phoneVerifiedAt,
    })
    .from(user)
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);

  if (!identity) return [];
  const channels: AvailableChannel[] = [];
  if (identity.emailVerified) {
    channels.push({ channel: "EMAIL", destinationMasked: maskEmail(identity.email) });
  }
  if (identity.phoneNumber && identity.phoneVerifiedAt) {
    channels.push({ channel: "WHATSAPP", destinationMasked: maskPhone(identity.phoneNumber) });
  }
  return channels;
}

export async function requestOtp(input: {
  userId: string;
  sessionId?: string | null;
  requestId: string;
  purpose: AuthPurpose;
  channel: AuthChannel;
  ipKey: string;
}) {
  const now = new Date();
  const channels = await getAvailableOtpChannels(input.userId);
  const available = channels.find((entry) => entry.channel === input.channel);
  if (!available) {
    await recordAuthEvent({
      requestId: input.requestId,
      userId: input.userId,
      purpose: input.purpose,
      channel: input.channel,
      eventType: "OTP_REJECTED",
      safeReasonCode: "CHANNEL_NOT_VERIFIED",
    });
    return { ok: false as const, error: "CHANNEL_NOT_AVAILABLE" };
  }

  const ipRate = await consumeRateLimit(`auth-otp:ip:${input.ipKey}:${input.purpose}`, 30, 3600, { fallbackLimit: 5 });
  if (!ipRate.allowed) {
    await recordAuthEvent({
      requestId: input.requestId,
      userId: input.userId,
      purpose: input.purpose,
      channel: input.channel,
      eventType: "OTP_RATE_LIMITED",
      safeReasonCode: "IP_LIMIT",
    });
    return { ok: false as const, error: "RATE_LIMITED", retryAfterSeconds: ipRate.retryAfterSeconds };
  }

  const userRate = await consumeRateLimit(`auth-otp:user:${input.userId}:${input.purpose}`, 25, 3600, { fallbackLimit: 5 });
  if (!userRate.allowed) {
    await recordAuthEvent({
      requestId: input.requestId,
      userId: input.userId,
      purpose: input.purpose,
      channel: input.channel,
      eventType: "OTP_RATE_LIMITED",
      safeReasonCode: "USER_LIMIT",
    });
    return { ok: false as const, error: "RATE_LIMITED", retryAfterSeconds: userRate.retryAfterSeconds };
  }

  const [identity] = await db
    .select({
      email: user.email,
      phoneNumber: userProfile.phoneNumber,
      locale: user.locale,
      name: user.name,
    })
    .from(user)
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!identity) return { ok: false as const, error: "USER_NOT_FOUND" };

  const destination = input.channel === "EMAIL" ? identity.email : identity.phoneNumber;
  if (!destination) return { ok: false as const, error: "CHANNEL_NOT_AVAILABLE" };

  const [existing] = await db
    .select()
    .from(authVerificationChallenge)
    .where(
      and(
        eq(authVerificationChallenge.userId, input.userId),
        eq(authVerificationChallenge.purpose, input.purpose),
        input.sessionId ? eq(authVerificationChallenge.sessionId, input.sessionId) : sql`true`,
        eq(authVerificationChallenge.channel, input.channel),
        eq(authVerificationChallenge.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(authVerificationChallenge.createdAt))
    .limit(1);

  if (existing && existing.resendAvailableAt.getTime() > now.getTime()) {
    return {
      ok: false as const,
      error: "RESEND_COOLDOWN",
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000)),
    };
  }

  const code = generateAuthOtp();
  const created = await db.transaction(async (tx) => {
    await tx
      .update(authVerificationChallenge)
      .set({ status: "SUPERSEDED", supersededAt: now, updatedAt: now })
      .where(
        and(
          eq(authVerificationChallenge.userId, input.userId),
          eq(authVerificationChallenge.purpose, input.purpose),
          input.sessionId ? eq(authVerificationChallenge.sessionId, input.sessionId) : sql`true`,
          eq(authVerificationChallenge.status, "ACTIVE"),
        ),
      );

    const [row] = await tx
      .insert(authVerificationChallenge)
      .values({
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        purpose: input.purpose,
        channel: input.channel,
        destination,
        destinationMasked: available.destinationMasked,
        codeHash: hashAuthOtp(crypto.randomUUID(), code),
        status: "ACTIVE",
        attemptCount: 0,
        maxAttempts: AUTH_OTP_MAX_ATTEMPTS,
        resendAvailableAt: new Date(now.getTime() + AUTH_OTP_RESEND_COOLDOWN_SECONDS * 1000),
        expiresAt: new Date(now.getTime() + AUTH_OTP_TTL_MINUTES * 60_000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const codeHash = hashAuthOtp(row.id, code);
    await tx.update(authVerificationChallenge).set({ codeHash, updatedAt: now }).where(eq(authVerificationChallenge.id, row.id));

    return row;
  });

  try {
    if (input.channel === "EMAIL") {
      await sendMail({
        to: destination,
        subject: "ANEI verification code",
        text: `Bonjour ${identity.name},\n\nVotre code de vérification ANEI est: ${code}\n\nExpire dans 5 minutes.`,
        html: `<div><p>Bonjour ${identity.name},</p><p>Votre code de vérification ANEI est <strong>${code}</strong>.</p><p>Expire dans 5 minutes.</p></div>`,
      }, "OTP");
    } else {
      const organizationId = await resolvePreferredWhatsappOrganization(input.userId);
      if (!organizationId) throw new Error("missing_org_for_whatsapp_auth_otp");
      const send = await enqueueSystemWhatsAppAuthOtp({
        organizationId,
        destinationPhone: destination,
        requestId: `otp:${input.purpose}:${created.id}:${created.deliveryVersion}`,
        code,
        locale: identity.locale === "ar" ? "ar" : "fr",
      });
      if (send.kind !== "ok") throw new Error(`whatsapp_delivery_${send.kind}`);
    }
  } catch {
    await db.update(authVerificationChallenge).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(authVerificationChallenge.id, created.id));
    await recordAuthEvent({
      requestId: input.requestId,
      userId: input.userId,
      purpose: input.purpose,
      channel: input.channel,
      eventType: "OTP_DELIVERY_FAILED",
      safeReasonCode: "DELIVERY_ERROR",
    });
    return { ok: false as const, error: "DELIVERY_FAILED" };
  }

  await recordAuthEvent({
    requestId: input.requestId,
    userId: input.userId,
    purpose: input.purpose,
    channel: input.channel,
    eventType: "OTP_SENT",
  });

  return {
    ok: true as const,
    challengeId: created.id,
    destinationMasked: created.destinationMasked,
    resendAvailableAt: created.resendAvailableAt.toISOString(),
    expiresAt: created.expiresAt.toISOString(),
  };
}

export async function verifyOtp(input: {
  userId: string;
  sessionId?: string | null;
  requestId: string;
  challengeId: string;
  purpose: AuthPurpose;
  code: string;
}) {
  const now = new Date();
  const [challenge] = await db
    .select()
    .from(authVerificationChallenge)
    .where(
      and(
        eq(authVerificationChallenge.id, input.challengeId),
        eq(authVerificationChallenge.userId, input.userId),
        eq(authVerificationChallenge.purpose, input.purpose),
        input.sessionId ? eq(authVerificationChallenge.sessionId, input.sessionId) : sql`true`,
      ),
    )
    .limit(1);

  if (!challenge) return { ok: false as const, error: "INVALID_CHALLENGE" };
  if (challenge.status !== "ACTIVE") return { ok: false as const, error: "INVALID_CHALLENGE_STATE" };
  if (challenge.expiresAt.getTime() <= now.getTime()) {
    await db.update(authVerificationChallenge).set({ status: "EXPIRED", updatedAt: now }).where(eq(authVerificationChallenge.id, challenge.id));
    await recordAuthEvent({
      requestId: input.requestId,
      userId: input.userId,
      purpose: input.purpose,
      channel: challenge.channel as AuthChannel,
      eventType: "OTP_EXPIRED",
      safeReasonCode: "OTP_EXPIRED",
    });
    return { ok: false as const, error: "OTP_EXPIRED" };
  }

  const expected = hashAuthOtp(challenge.id, input.code);
  if (!digestEqual(expected, challenge.codeHash)) {
    const nextCount = challenge.attemptCount + 1;
    const lock = nextCount >= challenge.maxAttempts;
    await db
      .update(authVerificationChallenge)
      .set({
        attemptCount: nextCount,
        status: lock ? "LOCKED" : "ACTIVE",
        updatedAt: now,
      })
      .where(eq(authVerificationChallenge.id, challenge.id));
    await recordAuthEvent({
      requestId: input.requestId,
      userId: input.userId,
      purpose: input.purpose,
      channel: challenge.channel as AuthChannel,
      eventType: "OTP_REJECTED",
      safeReasonCode: lock ? "MAX_ATTEMPTS" : "INVALID_OTP",
    });
    return { ok: false as const, error: lock ? "OTP_ATTEMPTS_EXHAUSTED" : "INVALID_OTP" };
  }

  await db
    .update(authVerificationChallenge)
    .set({ status: "VERIFIED", verifiedAt: now, updatedAt: now })
    .where(eq(authVerificationChallenge.id, challenge.id));

  await recordAuthEvent({
    requestId: input.requestId,
    userId: input.userId,
    purpose: input.purpose,
    channel: challenge.channel as AuthChannel,
    eventType: "OTP_VERIFIED",
  });

  return {
    ok: true as const,
    challengeId: challenge.id,
    channel: challenge.channel as AuthChannel,
    verifiedAt: now,
  };
}
