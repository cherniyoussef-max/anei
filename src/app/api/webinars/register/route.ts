import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { webinarRegistrations, webinars } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({ webinarId: z.string().uuid() });
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`webinar-register:${session.user.id}`, 20, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const [webinar] = await db.select({ id: webinars.id }).from(webinars).where(eq(webinars.id, parsed.data.webinarId)).limit(1);
  if (!webinar) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(webinarRegistrations).values({ webinarId: webinar.id, userId: session.user.id }).onConflictDoNothing({ target: [webinarRegistrations.webinarId, webinarRegistrations.userId] });
  return NextResponse.json({ ok: true });
}
