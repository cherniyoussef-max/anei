import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, rewardItem, rewardRedemption } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const patchSchema = z.object({
  titleFr: z.string().trim().min(3).max(180).optional(),
  titleAr: z.string().trim().min(3).max(180).optional(),
  descriptionFr: z.string().trim().max(2000).optional(),
  descriptionAr: z.string().trim().max(2000).optional(),
  costPoints: z.number().int().positive().max(1_000_000).optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  coverImageObjectKey: z.string().min(3).max(1024).regex(/^[a-zA-Z0-9._\/-]+$/).nullable().optional(),
  published: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("rewards.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = patchSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { coverImageObjectKey, ...rest } = parsed.data;
  const update = { ...rest, ...(coverImageObjectKey !== undefined ? { coverImage: coverImageObjectKey || null } : {}), updatedAt: new Date() };
  const [item] = await db.update(rewardItem).set(update).where(eq(rewardItem.id, id.data)).returning();
  if (!item) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "reward.update", entityType: "reward_item", entityId: id.data, metadata: parsed.data });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("rewards.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [{ value: redemptionCount }] = await db.select({ value: count() }).from(rewardRedemption).where(eq(rewardRedemption.rewardItemId, id.data));
  if (redemptionCount > 0) {
    const [item] = await db.update(rewardItem).set({ published: false, updatedAt: new Date() }).where(eq(rewardItem.id, id.data)).returning({ id: rewardItem.id });
    if (!item) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "reward.archive", entityType: "reward_item", entityId: id.data, metadata: { redemptionCount } });
    return NextResponse.json({ ok: true, archived: true });
  }

  const [item] = await db.delete(rewardItem).where(eq(rewardItem.id, id.data)).returning({ id: rewardItem.id });
  if (!item) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "reward.delete", entityType: "reward_item", entityId: id.data });
  return NextResponse.json({ ok: true, archived: false });
}
