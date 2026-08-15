import { NextResponse } from "next/server";
import { z } from "zod";
import { getFreshSession } from "@/server/auth/session";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { claimInvitation } from "@/server/services/invitations";

const schema = z
  .object({ token: z.string().trim().min(40).max(200) })
  .strict();

/**
 * The ONLY route that links a CRM contact to an ANEI user. Requires a real
 * Better Auth session (the user id comes from the session, never the body),
 * so phone verification alone can never create or link an account. Per-user
 * rate limiting; idempotent for the same user.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getFreshSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`inv:claim:${session.user.id}`, 10, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });

  const result = await claimInvitation(session.user.id, parsed.data.token);
  if (result.kind === "invalid_token" || result.kind === "not_found") return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ error: "INVALID_STATE" }, { status: 409 });
  if (result.kind === "expired") return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  if (result.kind === "invalid_contact") return NextResponse.json({ error: "CONTACT_NOT_FOUND" }, { status: 422 });
  if (result.kind === "claim_conflict") return NextResponse.json({ error: "CLAIM_CONFLICT" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CLAIM_FAILED" }, { status: 409 });
  return NextResponse.json({ ok: true });
}