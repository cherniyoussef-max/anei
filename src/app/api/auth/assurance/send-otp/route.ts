import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { requestFingerprint } from "@/server/security/rate-limit";
import { requestOtp } from "@/server/auth/otp";
import { getRequestId } from "@/server/auth/request-id";

const schema = z.object({ channel: z.enum(["EMAIL", "WHATSAPP"]) }).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await requestOtp({
    userId: session.user.id,
    sessionId: session.session.id,
    requestId: getRequestId(request),
    purpose: "LOGIN",
    channel: parsed.data.channel,
    ipKey: requestFingerprint(request),
  });

  if (!result.ok) {
    const status = result.error === "RATE_LIMITED" || result.error === "RESEND_COOLDOWN" ? 429 : 400;
    return NextResponse.json({ error: result.error, retryAfterSeconds: "retryAfterSeconds" in result ? result.retryAfterSeconds : null }, { status });
  }

  return NextResponse.json(result);
}
