import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const rate = await consumeRateLimit(`contact:${requestFingerprint(request)}`, 5, 600);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  await db.insert(contactMessages).values(parsed.data);
  return NextResponse.json({ ok: true }, { status: 201 });
}
