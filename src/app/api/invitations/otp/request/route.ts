import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { requestVerificationCode } from "@/server/services/invitations";

const schema = z
  .object({ token: z.string().trim().min(40).max(200) })
  .strict();

/**
 * Public phone-verification step. Aggressively rate-limited by IP on top of
 * the service-level per-invitation cooldown and send cap. The destination
 * phone is the invitation's server-side snapshot — the client never submits
 * one. Errors stay controlled and generic (no enumeration, no account detail).
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const rate = await consumeRateLimit(`inv:otp-request:${requestFingerprint(request)}`, 5, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });

  const result = await requestVerificationCode(parsed.data.token);
  if (result.kind === "invalid_token" || result.kind === "not_found") return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ error: "INVALID_STATE" }, { status: 409 });
  if (result.kind === "already_verified") return NextResponse.json({ error: "ALREADY_VERIFIED" }, { status: 409 });
  if (result.kind === "expired") return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  if (result.kind === "cooldown") return NextResponse.json({ error: "COOLDOWN" }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
  if (result.kind === "limit_reached") return NextResponse.json({ error: "LIMIT_REACHED" }, { status: 429 });
  if (result.kind === "no_account") return NextResponse.json({ error: "NO_ACCOUNT" }, { status: 422 });
  if (result.kind === "invalid_template") return NextResponse.json({ error: "INVALID_TEMPLATE" }, { status: 422 });
  if (result.kind === "not_configured") return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (result.kind === "provider_error") {
    return NextResponse.json(
      { error: "PROVIDER_ERROR", providerErrorCode: result.providerErrorCode, providerErrorMessage: result.providerErrorMessage },
      { status: 502 },
    );
  }
  if (result.kind !== "ok") return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}