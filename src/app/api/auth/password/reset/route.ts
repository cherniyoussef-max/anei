import { NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { resetPasswordWithToken } from "@/server/auth/password-recovery";
import { getRequestId } from "@/server/auth/request-id";

const schema = z
  .object({
    token: z.string().min(24).max(512),
    newPassword: z.string().min(15).max(128),
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const rate = await consumeRateLimit(`password-reset-ip:${requestFingerprint(request)}`, 5, 600);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await resetPasswordWithToken({
    requestId: getRequestId(request),
    token: parsed.data.token,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
