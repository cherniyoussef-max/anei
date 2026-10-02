import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getSessionAssurance } from "@/server/auth/assurance";
import { updateLearnerProfile } from "@/server/auth/profile";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function PATCH(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`profile-update:${session.user.id}`, 30, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  if (!(await getSessionAssurance(session.session.id))) return NextResponse.json({ error: "ASSURANCE_REQUIRED" }, { status: 403 });
  const body = await readLimitedJson(request).catch(() => null);
  const result = await updateLearnerProfile(session.user.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error, details: "details" in result ? result.details : null }, { status: result.error === "PROFILE_NOT_FOUND" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}
