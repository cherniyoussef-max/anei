import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, purchases, resources } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const patchSchema = z.object({
  titleFr: z.string().trim().min(3).max(180).optional(),
  titleAr: z.string().trim().min(3).max(180).optional(),
  descriptionFr: z.string().trim().min(3).max(3000).optional(),
  descriptionAr: z.string().trim().min(3).max(3000).optional(),
  audienceFr: z.string().trim().min(2).max(240).optional(),
  audienceAr: z.string().trim().min(2).max(240).optional(),
  type: z.string().trim().min(2).max(80).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  priceMillimes: z.number().int().nonnegative().max(100_000_000).optional(),
  coverImageObjectKey: z.string().min(3).max(1024).regex(/^[a-zA-Z0-9._\/-]+$/).nullable().optional(),
  downloadObjectKey: z.string().min(3).max(1024).regex(/^[a-zA-Z0-9._\/-]+$/).nullable().optional(),
  published: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("resources.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = patchSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { coverImageObjectKey, downloadObjectKey, ...rest } = parsed.data;
  const update = {
    ...rest,
    ...(coverImageObjectKey !== undefined ? { coverImage: coverImageObjectKey || null } : {}),
    ...(downloadObjectKey !== undefined ? { downloadUrl: downloadObjectKey || null } : {}),
  };
  const [resource] = await db.update(resources).set(update).where(eq(resources.id, id.data)).returning();
  if (!resource) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "resource.update", entityType: "resource", entityId: id.data, metadata: parsed.data });
  return NextResponse.json({ resource });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("resources.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [{ value: purchaseCount }] = await db.select({ value: count() }).from(purchases).where(eq(purchases.resourceId, id.data));
  if (purchaseCount > 0) {
    const [resource] = await db.update(resources).set({ published: false }).where(eq(resources.id, id.data)).returning({ id: resources.id });
    if (!resource) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "resource.archive", entityType: "resource", entityId: id.data, metadata: { purchaseCount } });
    return NextResponse.json({ ok: true, archived: true });
  }

  const [resource] = await db.delete(resources).where(eq(resources.id, id.data)).returning({ id: resources.id });
  if (!resource) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "resource.delete", entityType: "resource", entityId: id.data });
  return NextResponse.json({ ok: true, archived: false });
}
