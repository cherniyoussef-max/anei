import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { auditLogs, newsPosts } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120),
  tagFr: z.string().min(2).max(80),
  tagAr: z.string().min(2).max(80),
  titleFr: z.string().min(3).max(220),
  titleAr: z.string().min(3).max(220),
  excerptFr: z.string().min(3).max(600),
  excerptAr: z.string().min(3).max(600),
  contentFr: z.string().min(3).max(30000),
  contentAr: z.string().min(3).max(30000),
  published: z.boolean().default(true),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("news.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const [post] = await db.insert(newsPosts).values({ ...parsed.data, publishedAt: parsed.data.published ? new Date() : null }).returning();
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "news.create", entityType: "newsPost", entityId: post.id });
    return NextResponse.json({ post }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
