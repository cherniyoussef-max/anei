import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { auditLogs, newsPosts } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { revalidateAllPublicFeeds } from "@/server/services/auto-news-syndication";

const CATEGORY_TAGS: Record<string, { fr: string; ar: string }> = {
  FORMATION: { fr: "Formation", ar: "تكوين" },
  CERTIFICATION: { fr: "Certification", ar: "مصادقة" },
  PARTENARIAT: { fr: "Partenariat", ar: "شراكة" },
  EVENEMENT: { fr: "Événement", ar: "فعاليات" },
  COMMUNIQUE: { fr: "Communiqué", ar: "بلاغ" },
};

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120),
  category: z.enum(["FORMATION", "CERTIFICATION", "PARTENARIAT", "EVENEMENT", "COMMUNIQUE"]).default("FORMATION"),
  tagFr: z.string().min(2).max(80).optional(),
  tagAr: z.string().min(2).max(80).optional(),
  titleFr: z.string().min(3).max(220),
  titleAr: z.string().min(3).max(220),
  excerptFr: z.string().min(3).max(600),
  excerptAr: z.string().min(3).max(600),
  contentFr: z.string().min(3).max(30000),
  contentAr: z.string().min(3).max(30000),
  coverImageUrl: z.string().url().max(1000).optional().nullable().or(z.literal("")),
  isFeatured: z.boolean().default(false),
  published: z.boolean().default(true),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("news.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const rawJson = await readLimitedJson(request).catch(() => null);
  const parsed = schema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const tagFr = data.tagFr?.trim() || CATEGORY_TAGS[data.category]?.fr || "Actualité";
  const tagAr = data.tagAr?.trim() || CATEGORY_TAGS[data.category]?.ar || "أخبار";
  const coverImageUrl = data.coverImageUrl?.trim() || null;

  try {
    // If marked featured, atomically unset any existing featured article so only one is featured
    if (data.isFeatured) {
      await db.update(newsPosts).set({ isFeatured: false }).where(eq(newsPosts.isFeatured, true));
    }

    const [post] = await db
      .insert(newsPosts)
      .values({
        slug: data.slug,
        category: data.category,
        coverImageUrl,
        isFeatured: data.isFeatured,
        tagFr,
        tagAr,
        titleFr: data.titleFr,
        titleAr: data.titleAr,
        excerptFr: data.excerptFr,
        excerptAr: data.excerptAr,
        contentFr: data.contentFr,
        contentAr: data.contentAr,
        published: data.published,
        publishedAt: data.published ? new Date() : null,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "news.create",
      entityType: "newsPost",
      entityId: post.id,
    });

    // Revalidate all public feeds immediately (Actualités, Home, Formations, Établissement)
    revalidateAllPublicFeeds();

    return NextResponse.json({ post }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
