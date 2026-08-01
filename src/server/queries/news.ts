import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { newsPosts } from "@/server/db/schema";

export function getPublishedNews() {
  return db.select().from(newsPosts).where(eq(newsPosts.published, true)).orderBy(desc(newsPosts.publishedAt), desc(newsPosts.createdAt));
}

export function getPublishedNewsBySlug(slug: string) {
  return db.query.newsPosts.findFirst({ where: and(eq(newsPosts.slug, slug), eq(newsPosts.published, true)) });
}
