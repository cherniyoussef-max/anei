import { and, asc, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { appointment, certificates, courseModules, courses, crmContact, enrollments, learningAssessment, learningAttempt, lessonProgress, lessons, notifications, purchases, resources, user, webinarRegistrations, webinars } from "@/server/db/schema";
import { env } from "@/server/env";
import { signedMediaUrl } from "@/server/storage";

export async function getDashboardData(userId: string) {
  const [enrollmentRows, purchaseRows, certificateRows, upcomingWebinars] = await Promise.all([
    db
      .select({
        enrollment: {
          id: enrollments.id,
          progressPercent: enrollments.progressPercent,
          status: enrollments.status,
        },
        course: {
          id: courses.id,
          slug: courses.slug,
          titleFr: courses.titleFr,
          titleAr: courses.titleAr,
          category: courses.category,
          coverImage: courses.coverImage,
        },
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(24),
    db
      .select({
        purchase: { grantedAt: purchases.grantedAt },
        resource: {
          id: resources.id,
          titleFr: resources.titleFr,
          titleAr: resources.titleAr,
          descriptionFr: resources.descriptionFr,
          descriptionAr: resources.descriptionAr,
          type: resources.type,
          coverImage: resources.coverImage,
        },
      })
      .from(purchases)
      .leftJoin(resources, eq(purchases.resourceId, resources.id))
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.grantedAt))
      .limit(20),
    db
      .select({
        certificate: { id: certificates.id, code: certificates.code, issuedAt: certificates.issuedAt, fileUrl: certificates.fileUrl },
        course: { titleFr: courses.titleFr, titleAr: courses.titleAr },
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt))
      .limit(20),
    db
      .select({
        webinar: {
          id: webinars.id,
          titleFr: webinars.titleFr,
          titleAr: webinars.titleAr,
          startsAt: webinars.startsAt,
          trainerName: webinars.trainerName,
          meetingUrl: webinars.meetingUrl,
        },
      })
      .from(webinarRegistrations)
      .innerJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
      .where(and(eq(webinarRegistrations.userId, userId), gte(webinars.startsAt, new Date())))
      .orderBy(asc(webinars.startsAt))
      .limit(4),
  ]);

  return { enrollmentRows, purchaseRows, certificateRows, upcomingWebinars };
}

export async function getUnreadNotificationCount(userId: string) {
  const [row] = await db.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return row?.value ?? 0;
}

export async function getLearnerNotifications(userId: string, limit = 30) {
  return db.select({ id: notifications.id, title: notifications.title, body: notifications.body, href: notifications.href, read: notifications.read, createdAt: notifications.createdAt }).from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(Math.min(50, Math.max(1, limit)));
}

export async function getLearnerAppointments(userId: string, history = false, limit = 20) {
  const now = new Date();
  return db
    .select({
      id: appointment.id,
      type: appointment.type,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      assignedToUserId: appointment.assignedToUserId,
      assignedToName: user.name,
    })
    .from(appointment)
    .innerJoin(crmContact, and(eq(appointment.contactId, crmContact.id), eq(appointment.organizationId, crmContact.organizationId)))
    .innerJoin(user, eq(appointment.assignedToUserId, user.id))
    .where(and(eq(crmContact.linkedUserId, userId), history ? lt(appointment.startAt, now) : gte(appointment.startAt, now)))
    .orderBy(history ? desc(appointment.startAt) : asc(appointment.startAt))
    .limit(Math.min(50, Math.max(1, limit)));
}

export async function getLearnerCoursesPage(userId: string, limit = 24) {
  return db.select({
    enrollment: { id: enrollments.id, progressPercent: enrollments.progressPercent, status: enrollments.status },
    course: { id: courses.id, slug: courses.slug, titleFr: courses.titleFr, titleAr: courses.titleAr, category: courses.category },
  }).from(enrollments).innerJoin(courses, eq(enrollments.courseId, courses.id)).where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.enrolledAt)).limit(Math.min(48, Math.max(1, limit)));
}

export async function getLearnerResourcesPage(userId: string, limit = 30) {
  return db.select({
    purchase: { grantedAt: purchases.grantedAt },
    resource: { id: resources.id, titleFr: resources.titleFr, titleAr: resources.titleAr, descriptionFr: resources.descriptionFr, descriptionAr: resources.descriptionAr, type: resources.type },
  }).from(purchases).innerJoin(resources, eq(purchases.resourceId, resources.id)).where(eq(purchases.userId, userId)).orderBy(desc(purchases.grantedAt)).limit(Math.min(50, Math.max(1, limit)));
}

export async function getLearnerCertificatesPage(userId: string, limit = 30) {
  return db.select({
    certificate: { id: certificates.id, code: certificates.code, issuedAt: certificates.issuedAt, fileUrl: certificates.fileUrl },
    course: { titleFr: courses.titleFr, titleAr: courses.titleAr },
  }).from(certificates).innerJoin(courses, eq(certificates.courseId, courses.id)).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt)).limit(Math.min(50, Math.max(1, limit)));
}

export async function getOwnedCertificateForDownload(userId: string, certificateId: string) {
  const [row] = await db.select({
    id: certificates.id,
    code: certificates.code,
    fileUrl: certificates.fileUrl,
    courseTitleFr: courses.titleFr,
  }).from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .where(and(eq(certificates.id, certificateId), eq(certificates.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getLearningCourse(userId: string, slug: string) {
  const [row] = await db
    .select({ enrollment: enrollments, course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.userId, userId), eq(courses.slug, slug)))
    .limit(1);
  if (!row) return null;

  const [courseLessons, modules, progress, assessments] = await Promise.all([
    db.select().from(lessons).where(eq(lessons.courseId, row.course.id)).orderBy(asc(lessons.position)),
    db.select().from(courseModules).where(eq(courseModules.courseId, row.course.id)).orderBy(asc(courseModules.position)),
    db.select().from(lessonProgress).where(eq(lessonProgress.enrollmentId, row.enrollment.id)),
    db.select().from(learningAssessment).where(and(eq(learningAssessment.courseId, row.course.id), eq(learningAssessment.published, true))).orderBy(asc(learningAssessment.createdAt)),
  ]);
  const resolvedLessons = env.STORAGE_PROVIDER === "s3-compatible"
    ? await Promise.all(courseLessons.map(async (lesson) => ({
        ...lesson,
        videoUrl: lesson.videoUrl && !/^(?:https?:\/\/|\/)/.test(lesson.videoUrl) ? await signedMediaUrl(lesson.videoUrl) : lesson.videoUrl,
        documentUrl: lesson.documentUrl && !/^(?:https?:\/\/|\/)/.test(lesson.documentUrl) ? await signedMediaUrl(lesson.documentUrl) : lesson.documentUrl,
      })))
    : courseLessons;
  const attempts = assessments.length ? await db.select().from(learningAttempt)
    .where(and(eq(learningAttempt.userId, userId), inArray(learningAttempt.assessmentId, assessments.map((item) => item.id))))
    .orderBy(desc(learningAttempt.startedAt)) : [];
  const assessmentsWithAttempts = assessments.map((assessment) => {
    const assessmentAttempts = attempts.filter((attempt) => attempt.assessmentId === assessment.id);
    const bestGraded = assessmentAttempts.filter((attempt) => attempt.status === "GRADED").sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0] ?? null;
    return { assessment, attemptCount: assessmentAttempts.length, bestAttempt: bestGraded };
  });
  return { ...row, lessons: resolvedLessons, modules, progress, assessments: assessmentsWithAttempts };
}

export async function getLearningCourses(userId: string) {
  const rows = await db
    .select({ enrollment: enrollments, course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.enrolledAt));

  return rows.map((row) => {
    const progress = row.enrollment.progressPercent ?? 0;
    return {
      id: row.course.id,
      slug: row.course.slug,
      titleFr: row.course.titleFr,
      titleAr: row.course.titleAr,
      progressPercent: progress,
      status: row.enrollment.status,
    };
  });
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
