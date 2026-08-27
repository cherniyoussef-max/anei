import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/server/db";
import { newsPosts } from "@/server/db/schema";

export function getPublishedNews() {
  return db
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      tagFr: newsPosts.tagFr,
      tagAr: newsPosts.tagAr,
      titleFr: newsPosts.titleFr,
      titleAr: newsPosts.titleAr,
      excerptFr: newsPosts.excerptFr,
      excerptAr: newsPosts.excerptAr,
      publishedAt: newsPosts.publishedAt,
      createdAt: newsPosts.createdAt,
    })
    .from(newsPosts)
    .where(eq(newsPosts.published, true))
    .orderBy(desc(newsPosts.publishedAt), desc(newsPosts.createdAt))
    .limit(24);
}

/** Compact projection used by the homepage discovery chapter. */
export function listHomeNews() {
  return db
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      tagFr: newsPosts.tagFr,
      tagAr: newsPosts.tagAr,
      titleFr: newsPosts.titleFr,
      titleAr: newsPosts.titleAr,
      excerptFr: newsPosts.excerptFr,
      excerptAr: newsPosts.excerptAr,
      publishedAt: newsPosts.publishedAt,
      createdAt: newsPosts.createdAt,
    })
    .from(newsPosts)
    .where(eq(newsPosts.published, true))
    .orderBy(desc(newsPosts.publishedAt), desc(newsPosts.createdAt))
    .limit(3);
}

export function getPublishedNewsBySlug(slug: string) {
  return db.query.newsPosts.findFirst({ where: and(eq(newsPosts.slug, slug), eq(newsPosts.published, true)) });
}

const ADMIN_NEWS_PAGE_SIZE = 25;

/** Paginated news listing for the admin console — includes unpublished drafts. */
export async function listNewsAdminPage(input: { q?: string; page?: number } = {}) {
  const page = Math.max(1, input.page ?? 1);
  const where = input.q ? or(ilike(newsPosts.titleFr, `%${input.q}%`), ilike(newsPosts.titleAr, `%${input.q}%`), ilike(newsPosts.slug, `%${input.q}%`)) : undefined;
  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(newsPosts).where(where).orderBy(desc(newsPosts.createdAt)).limit(ADMIN_NEWS_PAGE_SIZE).offset((page - 1) * ADMIN_NEWS_PAGE_SIZE),
    db.select({ value: count() }).from(newsPosts).where(where),
  ]);
  return { items, total, page, pageSize: ADMIN_NEWS_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / ADMIN_NEWS_PAGE_SIZE)) };
}
