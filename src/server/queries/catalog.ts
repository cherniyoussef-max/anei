import { and, asc, count, desc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
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
  const trimmed = value?.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 100);
  return trimmed || undefined;
}

function searchTerms(value?: string) {
  return normalizedQuery(value)?.split(" ").filter(Boolean).slice(0, 8) ?? [];
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

const COURSE_FIXTURE_SLUG_PATTERN = "^(stream-course|learn-course|course|preview-course|target-course|public-course|enrolled-course)-[0-9a-f]{8}-";
const RESOURCE_FIXTURE_SLUG_PATTERN = "^storage-authz-resource-[0-9a-f]{8}-";
const HOMEPAGE_PLACEHOLDER_PATTERN = "^(test|course|sum|demo|example|exemple|placeholder)$";
const publicCourseFilter = and(eq(courses.published, true), sql`${courses.slug} !~ ${COURSE_FIXTURE_SLUG_PATTERN}`)!;
const publicResourceFilter = and(eq(resources.published, true), sql`${resources.slug} !~ ${RESOURCE_FIXTURE_SLUG_PATTERN}`)!;
const homepageCourseFilter = and(
  publicCourseFilter,
  sql`lower(trim(${courses.titleFr})) !~ ${HOMEPAGE_PLACEHOLDER_PATTERN}`,
  sql`lower(trim(${courses.titleAr})) !~ ${HOMEPAGE_PLACEHOLDER_PATTERN}`,
  sql`lower(trim(${courses.summaryFr})) !~ ${HOMEPAGE_PLACEHOLDER_PATTERN}`,
  sql`lower(trim(${courses.summaryAr})) !~ ${HOMEPAGE_PLACEHOLDER_PATTERN}`,
)!;

export type CourseSearchInput = {
  q?: string;
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
  mode?: "online" | "hybrid" | "onsite";
  price?: "free" | "paid";
  sort?: "relevance" | "featured" | "newest" | "price-asc" | "price-desc";
  page?: number;
  pageSize?: number;
};

export async function searchPublishedCourses(input: CourseSearchInput = {}) {
  const { page, pageSize, offset } = pageBounds(input.page, input.pageSize);
  const q = normalizedQuery(input.q);
  const filters: SQL[] = [publicCourseFilter];
  if (q) {
    for (const term of searchTerms(q)) {
      const pattern = `%${escapeLike(term)}%`;
      filters.push(or(
        ilike(courses.titleFr, pattern), ilike(courses.titleAr, pattern),
        ilike(courses.summaryFr, pattern), ilike(courses.summaryAr, pattern),
        ilike(courses.trainerName, pattern), ilike(courses.category, pattern),
      )!);
    }
  }
  if (input.category) filters.push(eq(courses.category, input.category.slice(0, 80)));
  if (input.level) filters.push(eq(courses.level, input.level));
  if (input.mode) filters.push(eq(courses.mode, input.mode));
  if (input.price === "free") filters.push(eq(courses.priceMillimes, 0));
  if (input.price === "paid") filters.push(gt(courses.priceMillimes, 0));
  const where = and(...filters)!;

  const exact = q ?? "";
  const prefix = `${escapeLike(q ?? "")}%`;
  const contains = `%${escapeLike(q ?? "")}%`;
  const relevance = sql<number>`case
    when lower(${courses.titleFr}) = lower(${exact}) or lower(${courses.titleAr}) = lower(${exact}) then 100
    when ${courses.titleFr} ilike ${prefix} or ${courses.titleAr} ilike ${prefix} then 70
    when ${courses.titleFr} ilike ${contains} or ${courses.titleAr} ilike ${contains} then 50
    when ${courses.trainerName} ilike ${contains} then 30
    when ${courses.summaryFr} ilike ${contains} or ${courses.summaryAr} ilike ${contains} then 20
    else 10 end`;
  let order = q && input.sort === "relevance"
    ? [desc(relevance), desc(courses.featured), asc(courses.startAt)]
    : [desc(courses.featured), asc(courses.startAt), desc(courses.createdAt)];
  if (input.sort === "newest") order = [desc(courses.createdAt)];
  if (input.sort === "price-asc") order = [asc(courses.priceMillimes), desc(courses.featured)];
  if (input.sort === "price-desc") order = [desc(courses.priceMillimes), desc(courses.featured)];

  const [[{ value: total }], items, categories] = await Promise.all([
    db.select({ value: count() }).from(courses).where(where),
    db.select().from(courses).where(where).orderBy(...order).limit(pageSize).offset(offset),
    db.selectDistinct({ value: courses.category }).from(courses).where(publicCourseFilter).orderBy(asc(courses.category)),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), categories: categories.map((row) => row.value) };
}

export async function listPublishedCourses() {
  return db.select().from(courses).where(publicCourseFilter).orderBy(desc(courses.featured), asc(courses.startAt)).limit(24);
}

/**
 * Homepage-only projection: keeps the same 24-row bound as listPublishedCourses
 * (the homepage derives its category chips from this pool) but skips the heavy
 * descriptionFr/descriptionAr/objectives columns, which the homepage never renders.
 */
export async function listHomeCourses() {
  return db.select({
    id: courses.id, slug: courses.slug, titleFr: courses.titleFr, titleAr: courses.titleAr,
    summaryFr: courses.summaryFr, summaryAr: courses.summaryAr, category: courses.category,
    durationMinutes: courses.durationMinutes, priceMillimes: courses.priceMillimes,
    startAt: courses.startAt, featured: courses.featured, level: courses.level,
    mode: courses.mode, trainerName: courses.trainerName,
  }).from(courses).where(homepageCourseFilter).orderBy(desc(courses.featured), asc(courses.startAt)).limit(24);
}

/** Homepage-only resource projection, intentionally capped to keep the public
 * landing page fast while still showing live, database-backed material. */
export async function listHomeResources() {
  return db.select({
    id: resources.id,
    slug: resources.slug,
    titleFr: resources.titleFr,
    titleAr: resources.titleAr,
    descriptionFr: resources.descriptionFr,
    descriptionAr: resources.descriptionAr,
    audienceFr: resources.audienceFr,
    audienceAr: resources.audienceAr,
    type: resources.type,
    createdAt: resources.createdAt,
  }).from(resources).where(publicResourceFilter).orderBy(desc(resources.createdAt)).limit(2);
}

export async function getPublishedCourse(slug: string) {
  const [course] = await db.select().from(courses).where(and(eq(courses.published, true), eq(courses.slug, slug))).limit(1);
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
      ? env.STORAGE_PROVIDER === "s3-compatible" ? await signedMediaUrl(lesson.videoUrl).catch(() => null) : lesson.videoUrl
      : null,
    documentUrl: null,
  })));
  return { course, lessons: publicLessons, modules };
}

export type ResourceSearchInput = {
  q?: string;
  type?: string;
  price?: "free" | "paid";
  sort?: "relevance" | "newest" | "price-asc" | "price-desc";
  page?: number;
  pageSize?: number;
};

export async function searchPublishedResources(input: ResourceSearchInput = {}) {
  const { page, pageSize, offset } = pageBounds(input.page, input.pageSize);
  const q = normalizedQuery(input.q);
  const filters: SQL[] = [publicResourceFilter];
  if (q) {
    for (const term of searchTerms(q)) {
      const pattern = `%${escapeLike(term)}%`;
      filters.push(or(
        ilike(resources.titleFr, pattern), ilike(resources.titleAr, pattern),
        ilike(resources.descriptionFr, pattern), ilike(resources.descriptionAr, pattern),
        ilike(resources.audienceFr, pattern), ilike(resources.audienceAr, pattern),
        ilike(resources.type, pattern),
      )!);
    }
  }
  if (input.type) filters.push(eq(resources.type, input.type.slice(0, 80)));
  if (input.price === "free") filters.push(eq(resources.priceMillimes, 0));
  if (input.price === "paid") filters.push(gt(resources.priceMillimes, 0));
  const where = and(...filters)!;
  const exact = q ?? "";
  const prefix = `${escapeLike(q ?? "")}%`;
  const contains = `%${escapeLike(q ?? "")}%`;
  const relevance = sql<number>`case
    when lower(${resources.titleFr}) = lower(${exact}) or lower(${resources.titleAr}) = lower(${exact}) then 100
    when ${resources.titleFr} ilike ${prefix} or ${resources.titleAr} ilike ${prefix} then 70
    when ${resources.titleFr} ilike ${contains} or ${resources.titleAr} ilike ${contains} then 50
    when ${resources.type} ilike ${contains} then 35
    when ${resources.audienceFr} ilike ${contains} or ${resources.audienceAr} ilike ${contains} then 25
    when ${resources.descriptionFr} ilike ${contains} or ${resources.descriptionAr} ilike ${contains} then 20
    else 10 end`;
  const order = q && input.sort === "relevance" ? [desc(relevance), desc(resources.createdAt)]
    : input.sort === "price-asc" ? [asc(resources.priceMillimes)]
      : input.sort === "price-desc" ? [desc(resources.priceMillimes)]
        : [desc(resources.createdAt)];
  const [[{ value: total }], rows, types] = await Promise.all([
    db.select({ value: count() }).from(resources).where(where),
    db.select().from(resources).where(where).orderBy(...order).limit(pageSize).offset(offset),
    db.selectDistinct({ value: resources.type }).from(resources).where(publicResourceFilter).orderBy(asc(resources.type)),
  ]);
  const items = await Promise.all(rows.map(async (row) => ({
    ...row,
    coverImageUrl: row.coverImage && env.STORAGE_PROVIDER === "s3-compatible" ? await signedMediaUrl(row.coverImage).catch(() => null) : null,
  })));
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), types: types.map((row) => row.value) };
}

export async function listPublishedResources() {
  return db.select().from(resources).where(publicResourceFilter).orderBy(desc(resources.createdAt)).limit(24);
}

const ADMIN_RESOURCE_PAGE_SIZE = 25;

/** Paginated resource listing for the admin console — includes unpublished resources. */
export async function listResourcesAdminPage(input: { q?: string; page?: number } = {}) {
  const { page, pageSize, offset } = pageBounds(input.page, ADMIN_RESOURCE_PAGE_SIZE);
  const q = normalizedQuery(input.q);
  const where = q ? or(ilike(resources.titleFr, `%${q}%`), ilike(resources.titleAr, `%${q}%`), ilike(resources.slug, `%${q}%`)) : undefined;
  const [[{ value: total }], items] = await Promise.all([
    db.select({ value: count() }).from(resources).where(where),
    db.select().from(resources).where(where).orderBy(desc(resources.createdAt)).limit(pageSize).offset(offset),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listPublishedWebinars() {
  return db.select().from(webinars).where(eq(webinars.published, true)).orderBy(asc(webinars.startsAt)).limit(100);
}

/** Homepage renders only the next 2 webinars, so this skips the description columns and the 100-row bound. */
export async function listHomeWebinars() {
  return db.select({
    id: webinars.id, titleFr: webinars.titleFr, titleAr: webinars.titleAr, trainerName: webinars.trainerName,
    startsAt: webinars.startsAt, replayUrl: webinars.replayUrl,
  }).from(webinars).where(eq(webinars.published, true)).orderBy(asc(webinars.startsAt)).limit(2);
}

const ADMIN_WEBINAR_PAGE_SIZE = 25;

/** Paginated webinar listing for the admin console — includes unpublished/archived webinars. */
export async function listWebinarsAdminPage(input: { q?: string; page?: number } = {}) {
  const { page, pageSize, offset } = pageBounds(input.page, ADMIN_WEBINAR_PAGE_SIZE);
  const q = normalizedQuery(input.q);
  const where = q ? or(ilike(webinars.titleFr, `%${q}%`), ilike(webinars.titleAr, `%${q}%`), ilike(webinars.slug, `%${q}%`)) : undefined;
  const [[{ value: total }], items] = await Promise.all([
    db.select({ value: count() }).from(webinars).where(where),
    db.select().from(webinars).where(where).orderBy(desc(webinars.startsAt)).limit(pageSize).offset(offset),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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

/** Homepage renders only 3 AVS cards, so this skips the bio/availability columns and the 24-row bound. */
export async function listHomeAvs() {
  return db.select({
    id: avsProfiles.id, displayName: avsProfiles.displayName, cityFr: avsProfiles.cityFr, cityAr: avsProfiles.cityAr,
    specialtyFr: avsProfiles.specialtyFr, specialtyAr: avsProfiles.specialtyAr, certified: avsProfiles.certified,
  }).from(avsProfiles).where(eq(avsProfiles.visible, true)).orderBy(desc(avsProfiles.certified), asc(avsProfiles.displayName)).limit(3);
}
