import { NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { requestInvitationOtp } from "@/server/services/account-invitations";

const bodySchema = z.object({ token: z.string().trim().min(16).max(512) }).strict();

const resultStatus: Record<string, number> = {
  ok: 200,
  invalid_invitation: 404,
  invitation_expired: 410,
  invitation_revoked: 410,
  already_consumed: 409,
  not_eligible: 422,
  not_configured: 503,
  send_cooldown: 429,
  send_limit: 429,
};

/**
 * Public, unauthenticated. The destination phone is always resolved
 * server-side from `invitation.destinationPhone` — the caller supplies only
 * the invitation token, never a phone number. Layered rate limiting: an IP
 * bucket here, plus per-invitation cooldown/daily-limit inside the service.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const rate = await consumeRateLimit(`invitation-otp-req:${requestFingerprint(request)}`, 20, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INVITATION" }, { status: 400 });

  const result = await requestInvitationOtp(parsed.data.token);
  if (result.kind === "ok") return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result.kind.toUpperCase() }, { status: resultStatus[result.kind] ?? 400 });
}
