import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { auditLogs, avsProfiles } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSession } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  displayName: z.string().min(2).max(160),
  cityFr: z.string().min(2).max(120),
  cityAr: z.string().min(2).max(120),
  specialtyFr: z.string().min(2).max(180),
  specialtyAr: z.string().min(2).max(180),
  availabilityFr: z.string().min(2).max(180),
  availabilityAr: z.string().min(2).max(180),
  bioFr: z.string().max(3000).default(""),
  bioAr: z.string().max(3000).default(""),
  certified: z.boolean().default(false),
  visible: z.boolean().default(true),
  image: z.string().url().nullable().optional(),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const [profile] = await db.insert(avsProfiles).values(parsed.data).returning();
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "avs.create", entityType: "avsProfile", entityId: profile.id });
  return NextResponse.json({ profile }, { status: 201 });
}
