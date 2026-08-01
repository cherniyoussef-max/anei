import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { auditLogs, webinars } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120),
  titleFr: z.string().min(3).max(180),
  titleAr: z.string().min(3).max(180),
  descriptionFr: z.string().min(3).max(2000),
  descriptionAr: z.string().min(3).max(2000),
  trainerName: z.string().min(2).max(120),
  startsAt: z.coerce.date(),
  durationMinutes: z.number().int().min(15).max(1440),
  meetingUrl: z.string().url().nullable().optional(),
  replayUrl: z.string().nullable().optional(),
  published: z.boolean().default(true),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("webinars.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const [webinar] = await db.insert(webinars).values(parsed.data).returning();
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "webinar.create", entityType: "webinar", entityId: webinar.id });
    return NextResponse.json({ webinar }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
