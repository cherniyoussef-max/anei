import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { claimAccountInvitation } from "@/server/services/account-invitations";

const bodySchema = z.object({ token: z.string().trim().min(16).max(512) }).strict();

const resultStatus: Record<string, number> = {
  ok: 200,
  invalid_invitation: 404,
  invitation_expired: 410,
  invitation_revoked: 410,
  not_verified: 422,
  already_consumed: 409,
  not_eligible: 422,
  link_conflict: 409,
};

/**
 * Requires a fresh, authenticated Better Auth session — the claimant is
 * always the caller's own session user, never a request-body field. This is
 * the ONLY place phase 6 links a CRM contact to an ANEI user or grants a
 * persona; the OTP step above never does either.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const rate = await consumeRateLimit(`invitation-claim:${session.user.id}`, 20, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INVITATION" }, { status: 400 });

  const result = await claimAccountInvitation(session.user.id, parsed.data.token);
  if (result.kind === "ok") return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result.kind.toUpperCase() }, { status: resultStatus[result.kind] ?? 400 });
}
