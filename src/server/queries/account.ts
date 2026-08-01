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
