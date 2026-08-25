import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { auditLogs, rewardItem } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  titleFr: z.string().min(3).max(180),
  titleAr: z.string().min(3).max(180),
  descriptionFr: z.string().max(2000).default(""),
  descriptionAr: z.string().max(2000).default(""),
  costPoints: z.number().int().positive().max(1_000_000),
  stock: z.number().int().nonnegative().nullable().optional(),
  coverImageObjectKey: z.string().min(3).max(1024).regex(/^[a-zA-Z0-9._\/-]+$/).nullable().optional(),
  published: z.boolean().default(true),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("rewards.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const { coverImageObjectKey, ...input } = parsed.data;
  const [item] = await db.insert(rewardItem).values({ ...input, coverImage: coverImageObjectKey || null }).returning();
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "reward.create", entityType: "reward_item", entityId: item.id });
  return NextResponse.json({ item }, { status: 201 });
}
