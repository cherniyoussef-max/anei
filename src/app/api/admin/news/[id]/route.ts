import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, newsPosts } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { revalidateAllPublicFeeds } from "@/server/services/auto-news-syndication";

const idSchema = z.string().uuid();

const updateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120).optional(),
  category: z.enum(["FORMATION", "CERTIFICATION", "PARTENARIAT", "EVENEMENT", "COMMUNIQUE"]).optional(),
  tagFr: z.string().min(2).max(80).optional(),
  tagAr: z.string().min(2).max(80).optional(),
  titleFr: z.string().min(3).max(220).optional(),
  titleAr: z.string().min(3).max(220).optional(),
  excerptFr: z.string().min(3).max(600).optional(),
  excerptAr: z.string().min(3).max(600).optional(),
  contentFr: z.string().min(3).max(30000).optional(),
  contentAr: z.string().min(3).max(30000).optional(),
  coverImageUrl: z.string().url().max(1000).optional().nullable().or(z.literal("")),
  isFeatured: z.boolean().optional(),
  published: z.boolean().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFor("news.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const post = await db.query.newsPosts.findFirst({
    where: eq(newsPosts.id, id.data),
  });
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ post });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("news.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const rawJson = await readLimitedJson(request).catch(() => null);
  const parsed = updateSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.query.newsPosts.findFirst({
    where: eq(newsPosts.id, id.data),
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patch = parsed.data;

  // If setting featured = true, atomically unset featured on all other articles
  if (patch.isFeatured === true) {
    await db.update(newsPosts).set({ isFeatured: false }).where(eq(newsPosts.isFeatured, true));
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (patch.slug !== undefined) updateValues.slug = patch.slug;
  if (patch.category !== undefined) updateValues.category = patch.category;
  if (patch.tagFr !== undefined) updateValues.tagFr = patch.tagFr;
  if (patch.tagAr !== undefined) updateValues.tagAr = patch.tagAr;
  if (patch.titleFr !== undefined) updateValues.titleFr = patch.titleFr;
  if (patch.titleAr !== undefined) updateValues.titleAr = patch.titleAr;
  if (patch.excerptFr !== undefined) updateValues.excerptFr = patch.excerptFr;
  if (patch.excerptAr !== undefined) updateValues.excerptAr = patch.excerptAr;
  if (patch.contentFr !== undefined) updateValues.contentFr = patch.contentFr;
  if (patch.contentAr !== undefined) updateValues.contentAr = patch.contentAr;
  if (patch.coverImageUrl !== undefined) updateValues.coverImageUrl = patch.coverImageUrl?.trim() || null;
  if (patch.isFeatured !== undefined) updateValues.isFeatured = patch.isFeatured;
  if (patch.published !== undefined) {
    updateValues.published = patch.published;
    if (patch.published && !existing.publishedAt) {
      updateValues.publishedAt = new Date();
    }
  }

  const [updated] = await db
    .update(newsPosts)
    .set(updateValues)
    .where(eq(newsPosts.id, id.data))
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "news.update",
    entityType: "newsPost",
    entityId: id.data,
  });

  revalidateAllPublicFeeds();
  if (updated.slug) {
    revalidatePath(`/fr/actualites/${updated.slug}`);
    revalidatePath(`/ar/actualites/${updated.slug}`);
    revalidatePath(`/en/actualites/${updated.slug}`);
  }

  return NextResponse.json({ post: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("news.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [post] = await db.delete(newsPosts).where(eq(newsPosts.id, id.data)).returning({ id: newsPosts.id, slug: newsPosts.slug });
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "news.delete",
    entityType: "newsPost",
    entityId: id.data,
  });

  revalidateAllPublicFeeds();

  return NextResponse.json({ ok: true });
}
