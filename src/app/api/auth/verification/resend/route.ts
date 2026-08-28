import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { env } from "@/server/env";
import { isLocale } from "@/lib/i18n";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { logger } from "@/server/security/logger";
import { categorizeMailError } from "@/server/services/mailer";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  locale: z.string().refine(isLocale),
}).strict();

const RESEND_COOLDOWN_SECONDS = 45;
const HOURLY_LIMIT = 5;

function maskRecipient(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "***";
  return `${local[0] ?? "*"}***@${domain}`;
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { email, locale } = parsed.data;
  const recipient = maskRecipient(email);

  const ipKey = requestFingerprint(request);
  const ipRate = await consumeRateLimit(`verify-email:resend:ip:${ipKey}`, 20, 3600, { fallbackLimit: 5 });
  if (!ipRate.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED", retryAfterSeconds: ipRate.retryAfterSeconds }, { status: 429 });
  }

  const emailHourly = await consumeRateLimit(`verify-email:resend:email:${email}`, HOURLY_LIMIT, 3600, { fallbackLimit: HOURLY_LIMIT });
  if (!emailHourly.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED", retryAfterSeconds: emailHourly.retryAfterSeconds }, { status: 429 });
  }

  const cooldown = await consumeRateLimit(`verify-email:resend:cooldown:${email}`, 1, RESEND_COOLDOWN_SECONDS);
  if (!cooldown.allowed) {
    return NextResponse.json({ error: "RESEND_COOLDOWN", retryAfterSeconds: cooldown.retryAfterSeconds }, { status: 429 });
  }

  const callbackURL = `/${locale}/verify-email?email=${encodeURIComponent(email)}`;

  try {
    await auth.api.sendVerificationEmail({ body: { email, callbackURL }, headers: request.headers });
    logger.info("mail.resend.succeeded", { type: "EMAIL_VERIFICATION", recipient, provider: env.SMTP_HOST });
    return NextResponse.json({ status: true });
  } catch (error) {
    const category = categorizeMailError(error);
    logger.error("mail.resend.failed", { type: "EMAIL_VERIFICATION", recipient, provider: env.SMTP_HOST, category });
    return NextResponse.json({ error: "DELIVERY_UNAVAILABLE" }, { status: 502 });
  }
}
