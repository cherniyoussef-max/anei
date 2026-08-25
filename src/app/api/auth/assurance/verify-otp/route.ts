import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getRequestId } from "@/server/auth/request-id";
import { verifyOtp } from "@/server/auth/otp";
import { completeSessionAssurance } from "@/server/auth/assurance";
import { recordAuthEvent } from "@/server/auth/events";

const schema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const requestId = getRequestId(request);

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const verified = await verifyOtp({
    userId: session.user.id,
    sessionId: session.session.id,
    requestId,
    challengeId: parsed.data.challengeId,
    purpose: "LOGIN",
    code: parsed.data.code,
  });
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  await completeSessionAssurance({ sessionId: session.session.id, userId: session.user.id, method: verified.channel });
  await recordAuthEvent({
    requestId,
    userId: session.user.id,
    purpose: "LOGIN",
    channel: verified.channel,
    eventType: "SESSION_ASSURANCE_COMPLETED",
  });

  return NextResponse.json({ ok: true });
}
