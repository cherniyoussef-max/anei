import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { verifyVerificationCode } from "@/server/services/invitations";

const schema = z
  .object({ token: z.string().trim().min(40).max(200), code: z.string().regex(/^\d{6}$/) })
  .strict();

/**
 * Public phone-verification step. A successful verify only advances the
 * invitation to VERIFIED — no account, no session, no authentication. Attempts
 * are rate-limited by IP; the bounded per-challenge budget is enforced in the
 * service under an advisory lock.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const rate = await consumeRateLimit(`inv:otp-verify:${requestFingerprint(request)}`, 20, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await verifyVerificationCode(parsed.data.token, parsed.data.code);
  if (result.kind === "invalid_token" || result.kind === "not_found") return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ error: "INVALID_STATE" }, { status: 409 });
  if (result.kind === "already_verified") return NextResponse.json({ error: "ALREADY_VERIFIED" }, { status: 409 });
  if (result.kind === "expired") return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  if (result.kind === "invalid_code") return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
  if (result.kind === "locked") return NextResponse.json({ error: "LOCKED" }, { status: 429 });
  if (result.kind !== "ok") return NextResponse.json({ error: "VERIFY_FAILED" }, { status: 409 });
  return NextResponse.json({ ok: true });
}