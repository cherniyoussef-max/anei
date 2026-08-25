import { NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { verifyInvitationOtp } from "@/server/services/account-invitations";

const bodySchema = z
  .object({
    token: z.string().trim().min(16).max(512),
    code: z.string().trim().regex(/^\d{6}$/),
  })
  .strict();

const resultStatus: Record<string, number> = {
  ok: 200,
  already_verified: 200,
  invalid_invitation: 404,
  invitation_expired: 410,
  invitation_revoked: 410,
  already_consumed: 409,
  not_eligible: 422,
  invalid_code: 400,
  code_expired: 410,
  attempts_exhausted: 429,
};

/**
 * Public, unauthenticated. Verification success is entirely DB-authoritative
 * (see src/server/services/account-invitations.ts) — this route never lets
 * the browser assert `verified=true`; it only ever reports the service's
 * own bounded result.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const rate = await consumeRateLimit(`invitation-otp-verify:${requestFingerprint(request)}`, 30, 3600, { fallbackLimit: 8 });
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const result = await verifyInvitationOtp(parsed.data.token, parsed.data.code);
  if (result.kind === "ok" || result.kind === "already_verified") return NextResponse.json({ verified: true });
  return NextResponse.json({ error: result.kind.toUpperCase() }, { status: resultStatus[result.kind] ?? 400 });
}
