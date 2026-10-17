import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { createPasswordResetRequest } from "@/server/auth/password-recovery";
import { getRequestId } from "@/server/auth/request-id";
import type { Locale } from "@/types";

const schema = z
  .object({
    email: z.string().email().max(255),
    locale: z.enum(["fr", "ar", "en"]).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const fingerprint = requestFingerprint(request);

  // Rate-limiting strict : Maximum 3 demandes par IP par tranche de 15 minutes (900s)
  const ipRate = await consumeRateLimit(`forgot-password-ip:${fingerprint}`, 3, 900);
  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSeconds) } },
    );
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Return standard success to prevent input probing
    return NextResponse.json({ ok: true });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const emailHash = crypto.createHash("sha256").update(normalizedEmail).digest("hex");

  // Rate-limiting strict : Maximum 3 demandes par email par tranche de 15 minutes (900s)
  const emailRate = await consumeRateLimit(`forgot-password-email:${emailHash}`, 3, 900);
  if (!emailRate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(emailRate.retryAfterSeconds) } },
    );
  }

  const locale: Locale = parsed.data.locale === "ar" ? "ar" : "fr";
  const requestId = getRequestId(request);

  await createPasswordResetRequest({
    email: normalizedEmail,
    locale,
    requestId,
    ipKey: fingerprint,
  });

  // Always return identical public success (Anti-Enumeration)
  return NextResponse.json({
    ok: true,
    message:
      locale === "ar"
        ? "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فقد تم إرسال رابط التعيين بنجاح."
        : "Si un compte est associé à cet e-mail, un lien de réinitialisation vient d'être envoyé.",
  });
}
