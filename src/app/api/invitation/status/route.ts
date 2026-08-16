import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { getInvitationLandingInfo } from "@/server/services/account-invitations";

const querySchema = z.object({ token: z.string().trim().min(16).max(512) });

/**
 * Public, unauthenticated invitation landing lookup. Authority comes from
 * the token itself (never from any other client-supplied id), and the
 * response discloses only the minimum needed for the landing UX —
 * organization display name, a masked phone, and a UX-relevant status.
 */
export async function GET(request: Request) {
  const rate = await consumeRateLimit(`invitation-status:${requestFingerprint(request)}`, 30, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = querySchema.safeParse({ token: new URL(request.url).searchParams.get("token") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INVITATION" }, { status: 400 });

  const info = await getInvitationLandingInfo(parsed.data.token);
  if (info.kind !== "ok") return NextResponse.json({ error: "INVALID_INVITATION" }, { status: 404 });
  return NextResponse.json({ organizationName: info.organizationName, maskedPhone: info.maskedPhone, status: info.status });
}
