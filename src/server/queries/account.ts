import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { certificates, courseModules, courses, enrollments, lessonProgress, lessons, notifications, orders, purchases, resources, webinarRegistrations, webinars } from "@/server/db/schema";
import { env } from "@/server/env";
import { signedMediaUrl } from "@/server/storage";

export async function getDashboardData(userId: string) {
  const [enrollmentRows, purchaseRows, certificateRows, upcomingWebinars, userNotifications] = await Promise.all([
    db
      .select({ enrollment: enrollments, course: courses })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.enrolledAt)),
    db
      .select({ purchase: purchases, resource: resources, order: orders })
      .from(purchases)
      .leftJoin(resources, eq(purchases.resourceId, resources.id))
      .innerJoin(orders, eq(purchases.orderId, orders.id))
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.grantedAt)),
    db
      .select({ certificate: certificates, course: courses })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt)),
    db
      .select({ registration: webinarRegistrations, webinar: webinars })
      .from(webinarRegistrations)
      .innerJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
      .where(eq(webinarRegistrations.userId, userId))
      .orderBy(asc(webinars.startsAt)),
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(8),
  ]);

  return { enrollmentRows, purchaseRows, certificateRows, upcomingWebinars, notifications: userNotifications };
}

export async function getLearningCourse(userId: string, slug: string) {
  const [row] = await db
    .select({ enrollment: enrollments, course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.userId, userId), eq(courses.slug, slug)))
    .limit(1);
  if (!row) return null;

  const [courseLessons, modules, progress] = await Promise.all([
    db.select().from(lessons).where(eq(lessons.courseId, row.course.id)).orderBy(asc(lessons.position)),
    db.select().from(courseModules).where(eq(courseModules.courseId, row.course.id)).orderBy(asc(courseModules.position)),
    db.select().from(lessonProgress).where(eq(lessonProgress.enrollmentId, row.enrollment.id)),
  ]);
  const resolvedLessons = env.STORAGE_PROVIDER === "s3-compatible"
    ? await Promise.all(courseLessons.map(async (lesson) => ({
        ...lesson,
        videoUrl: lesson.videoUrl ? await signedMediaUrl(lesson.videoUrl) : null,
        documentUrl: lesson.documentUrl ? await signedMediaUrl(lesson.documentUrl) : null,
      })))
    : courseLessons;
  return { ...row, lessons: resolvedLessons, modules, progress };
}

/**
 * Entitlement check for the private lesson-playback flow (Phase 8): resolves
 * course/enrollment from the lessonId alone, mirroring getLearningCourse's
 * enrollment join, so a caller can never substitute a courseId/organizationId
 * to bypass authorization. A preview lesson is entitled for any caller
 * (including an anonymous one, userId null) without an enrollment row.
 */
export async function getLessonForPlayback(userId: string | null, lessonId: string) {
  const [row] = await db
    .select({ lesson: lessons, courseId: courses.id })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!row) return null;
  if (row.lesson.preview) return { lesson: row.lesson, entitled: true };
  if (!userId) return { lesson: row.lesson, entitled: false };

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, row.courseId)))
    .limit(1);
  return { lesson: row.lesson, entitled: Boolean(enrollment) };
}

/** Entitlement check for the private resource-download flow: only the purchasing user's own resource. */
export async function getPurchasedResourceForDownload(userId: string, resourceId: string) {
  const [row] = await db
    .select({ resource: resources })
    .from(purchases)
    .innerJoin(resources, eq(purchases.resourceId, resources.id))
    .where(and(eq(purchases.userId, userId), eq(resources.id, resourceId)))
    .limit(1);
  return row?.resource;
}
