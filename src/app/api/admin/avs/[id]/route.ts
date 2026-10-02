import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, avsProfiles } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSession } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const updateSchema = z.object({
  displayName: z.string().min(2).max(160).optional(),
  cityFr: z.string().min(2).max(120).optional(),
  cityAr: z.string().min(2).max(120).optional(),
  governorateFr: z.string().min(2).max(100).optional(),
  governorateAr: z.string().min(2).max(100).optional(),
  specialtyFr: z.string().min(2).max(180).optional(),
  specialtyAr: z.string().min(2).max(180).optional(),
  availabilityFr: z.string().min(2).max(180).optional(),
  availabilityAr: z.string().min(2).max(180).optional(),
  interventionDomains: z.array(z.string()).optional(),
  pedagogicalMethods: z.array(z.string()).optional(),
  schoolsCoveredFr: z.string().optional(),
  schoolsCoveredAr: z.string().optional(),
  hourlyRateMillimes: z.coerce.number().optional(),
  experienceYears: z.coerce.number().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  bioFr: z.string().max(3000).optional(),
  bioAr: z.string().max(3000).optional(),
  certified: z.boolean().optional(),
  visible: z.boolean().optional(),
  image: z.string().url().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  
  const { id } = await params;
  const parsed = updateSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const [profile] = await db
    .update(avsProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(avsProfiles.id, id))
    .returning();

  if (!profile) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "avs.update",
    entityType: "avsProfile",
    entityId: profile.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true, profile });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const { id } = await params;
  const [deleted] = await db.delete(avsProfiles).where(eq(avsProfiles.id, id)).returning();
  if (!deleted) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "avs.delete",
    entityType: "avsProfile",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
