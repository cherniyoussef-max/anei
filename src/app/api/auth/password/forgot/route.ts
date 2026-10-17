import { NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { createPasswordResetRequest } from "@/server/auth/password-recovery";
import { getRequestId } from "@/server/auth/request-id";

const schema = z
  .object({
    email: z.string().email(),
    locale: z.enum(["fr", "ar", "en"]).optional(),
    channel: z.enum(["EMAIL", "WHATSAPP"]).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ ok: true });
  const rate = await consumeRateLimit(`forgot-password-ip:${requestFingerprint(request)}`, 3, 900);
  if (!rate.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  await createPasswordResetRequest({
    email: parsed.data.email,
    locale: parsed.data.locale === "ar" ? "ar" : "fr",
    requestId: getRequestId(request),
    ipKey: requestFingerprint(request),
  });

  return NextResponse.json({ ok: true });
}
