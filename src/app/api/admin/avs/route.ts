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
  governorateFr: z.string().min(2).max(100).default("Tunis"),
  governorateAr: z.string().min(2).max(100).default("تونس"),
  specialtyFr: z.string().min(2).max(180),
  specialtyAr: z.string().min(2).max(180),
  availabilityFr: z.string().min(2).max(180),
  availabilityAr: z.string().min(2).max(180),
  interventionDomains: z.array(z.string()).optional(),
  pedagogicalMethods: z.array(z.string()).optional(),
  schoolsCoveredFr: z.string().optional().default(""),
  schoolsCoveredAr: z.string().optional().default(""),
  hourlyRateMillimes: z.coerce.number().default(25000),
  experienceYears: z.coerce.number().default(3),
  phone: z.string().optional(),
  email: z.string().optional(),
  bioFr: z.string().max(3000).default(""),
  bioAr: z.string().max(3000).default(""),
  certified: z.boolean().default(false),
  visible: z.boolean().default(true),
  image: z.string().url().nullable().optional(),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const profiles = await db.select().from(avsProfiles).orderBy(avsProfiles.displayName);
  return NextResponse.json({ ok: true, profiles });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  
  const slug = parsed.data.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const [profile] = await db.insert(avsProfiles).values({ ...parsed.data, slug }).returning();
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "avs.create", entityType: "avsProfile", entityId: profile.id });
  return NextResponse.json({ profile }, { status: 201 });
}
