import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { getInvitationPublicInfo } from "@/server/services/invitations";

const schema = z.object({ token: z.string().trim().min(40).max(200) });

/**
 * Public, read-only invitation landing detail. The token is a high-entropy
 * bearer secret delivered via WhatsApp; it is never logged. Controlled errors:
 * an unknown/malformed token and an expired/revoked invitation all resolve to
 * the same bounded statuses, never to account-existence detail.
 */
export async function GET(request: Request) {
  const rate = await consumeRateLimit(`inv:info:${requestFingerprint(request)}`, 30, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const url = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });

  const result = await getInvitationPublicInfo(parsed.data.token);
  if (result.kind !== "ok" || !result.info) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
  return NextResponse.json(result.info);
}