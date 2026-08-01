import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { auditLogs, resources } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120),
  titleFr: z.string().min(3).max(180),
  titleAr: z.string().min(3).max(180),
  descriptionFr: z.string().min(3).max(3000),
  descriptionAr: z.string().min(3).max(3000),
  audienceFr: z.string().min(2).max(240),
  audienceAr: z.string().min(2).max(240),
  type: z.string().min(2).max(80),
  priceMillimes: z.number().int().nonnegative().max(100000000),
  downloadObjectKey: z.string().min(3).max(1024).regex(/^[a-zA-Z0-9._\/-]+$/).nullable().optional(),
  published: z.boolean().default(true),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("resources.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const { downloadObjectKey, ...input } = parsed.data;
    const [resource] = await db.insert(resources).values({ ...input, downloadUrl: downloadObjectKey || null }).returning();
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "resource.create", entityType: "resource", entityId: resource.id });
    return NextResponse.json({ resource }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
