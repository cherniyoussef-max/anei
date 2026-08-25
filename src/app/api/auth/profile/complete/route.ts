import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { completeUserProfile } from "@/server/auth/profile";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getRequestId } from "@/server/auth/request-id";
import { recordAuthEvent } from "@/server/auth/events";

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await readLimitedJson(request).catch(() => null);
  const result = await completeUserProfile(session.user.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error, details: "details" in result ? result.details : null }, { status: 400 });

  await recordAuthEvent({ requestId: getRequestId(request), userId: session.user.id, eventType: "PROFILE_COMPLETED" });
  return NextResponse.json({ ok: true });
}
