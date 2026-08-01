import { and, asc, count, desc, eq, gt, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { avsProfiles, courseModules, courses, lessons, resources, webinars } from "@/server/db/schema";
import { env } from "@/server/env";
import { signedMediaUrl } from "@/server/storage";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

function pageBounds(page?: number, pageSize?: number) {
  const safePage = Number.isSafeInteger(page) && (page ?? 0) > 0 ? page! : 1;
  const safeSize = Number.isSafeInteger(pageSize) ? Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize!)) : DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}

function normalizedQuery(value?: string) {
  const trimmed = value?.trim().slice(0, 100);
  return trimmed || undefined;
}

export type CourseSearchInput = {
  q?: string;
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
  mode?: "online" | "hybrid" | "onsite";
  price?: "free" | "paid";
  sort?: "featured" | "newest" | "price-asc" | "price-desc";
  page?: number;
  pageSize?: number;
};

export async function searchPublishedCourses(input: CourseSearchInput = {}) {
  const { page, pageSize, offset } = pageBounds(input.page, input.pageSize);
  const q = normalizedQuery(input.q);
  const filters: SQL[] = [eq(courses.published, true)];
  if (q) {
    const pattern = `%${q}%`;
    filters.push(or(
      ilike(courses.titleFr, pattern),
      ilike(courses.titleAr, pattern),
      ilike(courses.summaryFr, pattern),
      ilike(courses.summaryAr, pattern),
      ilike(courses.trainerName, pattern),
    )!);
  }
  if (input.category) filters.push(eq(courses.category, input.category.slice(0, 80)));
  if (input.level) filters.push(eq(courses.level, input.level));
  if (input.mode) filters.push(eq(courses.mode, input.mode));
  if (input.price === "free") filters.push(eq(courses.priceMillimes, 0));
  if (input.price === "paid") filters.push(gt(courses.priceMillimes, 0));
  const where = and(...filters)!;

  let order = [desc(courses.featured), asc(courses.startAt), desc(courses.createdAt)];
  if (input.sort === "newest") order = [desc(courses.createdAt)];
  if (input.sort === "price-asc") order = [asc(courses.priceMillimes), desc(courses.featured)];
  if (input.sort === "price-desc") order = [desc(courses.priceMillimes), desc(courses.featured)];

  const [[{ value: total }], items, categories] = await Promise.all([
    db.select({ value: count() }).from(courses).where(where),
    db.select().from(courses).where(where).orderBy(...order).limit(pageSize).offset(offset),
    db.selectDistinct({ value: courses.category }).from(courses).where(eq(courses.published, true)).orderBy(asc(courses.category)),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), categories: categories.map((row) => row.value) };
}

export async function listPublishedCourses() {
  return db.select().from(courses).where(eq(courses.published, true)).orderBy(desc(courses.featured), asc(courses.startAt)).limit(24);
}

export async function getPublishedCourse(slug: string) {
  const [course] = await db.select().from(courses).where(and(eq(courses.slug, slug), eq(courses.published, true))).limit(1);
  if (!course) return null;
  const [courseLessons, modules] = await Promise.all([
    db.select().from(lessons).where(eq(lessons.courseId, course.id)).orderBy(asc(lessons.position)),
    db.select().from(courseModules).where(eq(courseModules.courseId, course.id)).orderBy(asc(courseModules.position)),
  ]);
  // Public course pages receive only intentionally previewable media. Full lesson
  // object keys never need to reach public rendering paths.
  const publicLessons = await Promise.all(courseLessons.map(async (lesson) => ({
    ...lesson,
    videoUrl: lesson.preview && lesson.videoUrl
      ? env.STORAGE_PROVIDER === "s3-compatible" ? await signedMediaUrl(lesson.videoUrl) : lesson.videoUrl
      : null,
    documentUrl: null,
  })));
  return { course, lessons: publicLessons, modules };
}

export type ResourceSearchInput = {
  q?: string;
  type?: string;
  price?: "free" | "paid";
  sort?: "newest" | "price-asc" | "price-desc";
  page?: number;
  pageSize?: number;
};

export async function searchPublishedResources(input: ResourceSearchInput = {}) {
  const { page, pageSize, offset } = pageBounds(input.page, input.pageSize);
  const q = normalizedQuery(input.q);
  const filters: SQL[] = [eq(resources.published, true)];
  if (q) {
    const pattern = `%${q}%`;
    filters.push(or(
      ilike(resources.titleFr, pattern), ilike(resources.titleAr, pattern),
      ilike(resources.descriptionFr, pattern), ilike(resources.descriptionAr, pattern),
      ilike(resources.audienceFr, pattern), ilike(resources.audienceAr, pattern),
    )!);
  }
  if (input.type) filters.push(eq(resources.type, input.type.slice(0, 80)));
  if (input.price === "free") filters.push(eq(resources.priceMillimes, 0));
  if (input.price === "paid") filters.push(gt(resources.priceMillimes, 0));
  const where = and(...filters)!;
  const order = input.sort === "price-asc" ? [asc(resources.priceMillimes)] : input.sort === "price-desc" ? [desc(resources.priceMillimes)] : [desc(resources.createdAt)];
  const [[{ value: total }], items, types] = await Promise.all([
    db.select({ value: count() }).from(resources).where(where),
    db.select().from(resources).where(where).orderBy(...order).limit(pageSize).offset(offset),
    db.selectDistinct({ value: resources.type }).from(resources).where(eq(resources.published, true)).orderBy(asc(resources.type)),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), types: types.map((row) => row.value) };
}

export async function listPublishedResources() {
  return db.select().from(resources).where(eq(resources.published, true)).orderBy(desc(resources.createdAt)).limit(24);
}

export async function listPublishedWebinars() {
  return db.select().from(webinars).where(eq(webinars.published, true)).orderBy(asc(webinars.startsAt)).limit(100);
}

export type AvsSearchInput = { q?: string; city?: string; certified?: boolean; page?: number; pageSize?: number };

export async function searchVisibleAvs(input: AvsSearchInput = {}) {
  const { page, pageSize, offset } = pageBounds(input.page, input.pageSize);
  const q = normalizedQuery(input.q);
  const filters: SQL[] = [eq(avsProfiles.visible, true)];
  if (q) {
    const pattern = `%${q}%`;
    filters.push(or(
      ilike(avsProfiles.displayName, pattern),
      ilike(avsProfiles.cityFr, pattern), ilike(avsProfiles.cityAr, pattern),
      ilike(avsProfiles.specialtyFr, pattern), ilike(avsProfiles.specialtyAr, pattern),
    )!);
  }
  if (input.city) {
    const city = input.city.slice(0, 100);
    filters.push(or(eq(avsProfiles.cityFr, city), eq(avsProfiles.cityAr, city))!);
  }
  if (input.certified) filters.push(eq(avsProfiles.certified, true));
  const where = and(...filters)!;
  const [[{ value: total }], items, cityRows] = await Promise.all([
    db.select({ value: count() }).from(avsProfiles).where(where),
    db.select().from(avsProfiles).where(where).orderBy(desc(avsProfiles.certified), asc(avsProfiles.displayName)).limit(pageSize).offset(offset),
    db.select({ fr: avsProfiles.cityFr, ar: avsProfiles.cityAr }).from(avsProfiles).where(eq(avsProfiles.visible, true)),
  ]);
  const cities = Array.from(new Set(cityRows.flatMap((row) => [row.fr, row.ar]).filter(Boolean))).sort();
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), cities };
}

export async function listVisibleAvs() {
  return db.select().from(avsProfiles).where(eq(avsProfiles.visible, true)).orderBy(desc(avsProfiles.certified), asc(avsProfiles.displayName)).limit(24);
}
