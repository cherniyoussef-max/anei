import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { requestFingerprint } from "@/server/security/rate-limit";
import { requestOtp } from "@/server/auth/otp";
import { getRequestId } from "@/server/auth/request-id";

const schema = z.object({ email: z.string().email(), channel: z.enum(["EMAIL", "WHATSAPP"]).optional() }).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ ok: true });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, parsed.data.email.trim().toLowerCase())).limit(1);
  if (!row) return NextResponse.json({ ok: true });

  const requestId = getRequestId(request);
  await requestOtp({
    userId: row.id,
    sessionId: null,
    requestId,
    purpose: "PASSWORD_RESET",
    channel: parsed.data.channel ?? "EMAIL",
    ipKey: requestFingerprint(request),
  });

  return NextResponse.json({ ok: true });
}
