import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  appointment,
  certificates,
  courseModules,
  courses,
  crmContact,
  enrollments,
  learningAssessment,
  learningAttempt,
  learningQuestion,
  learningQuestionOption,
  lessons,
  lessonProgress,
  personaMembership,
  user,
  userProfile,
} from "@/server/db/schema";

const adminCourseEditorColumns = {
  id: courses.id,
  slug: courses.slug,
  titleFr: courses.titleFr,
  titleAr: courses.titleAr,
  summaryFr: courses.summaryFr,
  summaryAr: courses.summaryAr,
  descriptionFr: courses.descriptionFr,
  descriptionAr: courses.descriptionAr,
  category: courses.category,
  trainerName: courses.trainerName,
  durationMinutes: courses.durationMinutes,
  priceMillimes: courses.priceMillimes,
  level: courses.level,
  mode: courses.mode,
  published: courses.published,
  qualifiesForProfessionalPromotion: courses.qualifiesForProfessionalPromotion,
  qualifyingTargetType: courses.qualifyingTargetType,
  qualifyingTargetCategory: courses.qualifyingTargetCategory,
  coverImage: courses.coverImage,
  updatedAt: courses.updatedAt,
};

interface LearningCacheEntry<T> {
  data: T;
  expiresAt: number;
}
const memoryCache = new Map<string, LearningCacheEntry<unknown>>();
const LEARNING_CACHE_TTL_MS = 60_000;

function pruneMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

async function withLearningCache<T>(cacheKey: string, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const mem = memoryCache.get(cacheKey);
  if (mem && mem.expiresAt > now) {
    return mem.data as T;
  }

  try {
    const { getRedis } = await import("@/server/cache/redis");
    const redis = await getRedis();
    if (redis) {
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        const parsed = JSON.parse(cached) as T;
        if (memoryCache.size > 100) pruneMemoryCache();
        memoryCache.set(cacheKey, { data: parsed, expiresAt: now + LEARNING_CACHE_TTL_MS });
        return parsed;
      }
    }
  } catch {
    // Non-blocking
  }

  const value = await compute();
  if (memoryCache.size > 100) pruneMemoryCache();
  memoryCache.set(cacheKey, { data: value, expiresAt: now + LEARNING_CACHE_TTL_MS });

  try {
    const { getRedis } = await import("@/server/cache/redis");
    const redis = await getRedis();
    if (redis) {
      redis.set(cacheKey, JSON.stringify(value), { EX: 60 }).catch(() => undefined);
    }
  } catch {
    // Non-blocking
  }

  return value;
}

export async function getAdminCourseList(limit = 50) {
  const boundedLimit = Math.min(100, Math.max(1, limit));
  return withLearningCache(`admin:courses:list:${boundedLimit}`, async () => {
    const result = await db.execute<{
      id:string;slug:string;title_fr:string;title_ar:string;category:string;level:string;mode:string;
      price_millimes:number;published:boolean;updated_at:Date;enrollments:number;completion_rate:number;
    }>(sql`select c.id,c.slug,c.title_fr,c.title_ar,c.category,c.level,c.mode,c.price_millimes,c.published,c.updated_at,
      count(e.id)::int enrollments,
      coalesce(round(avg(e.progress_percent)),0)::int completion_rate
      from courses c left join enrollments e on e.course_id=c.id
      group by c.id order by c.updated_at desc limit ${boundedLimit}`);
    return result.rows;
  });
}

export async function getAdminCourseEditorBase(courseId: string) {
  const [course] = await db.select(adminCourseEditorColumns).from(courses).where(eq(courses.id, courseId)).limit(1);
  return course ?? null;
}

export const adminLessonCurriculumColumns = {
  id: lessons.id,
  courseId: lessons.courseId,
  moduleId: lessons.moduleId,
  position: lessons.position,
  titleFr: lessons.titleFr,
  titleAr: lessons.titleAr,
  descriptionFr: lessons.descriptionFr,
  descriptionAr: lessons.descriptionAr,
  durationSeconds: lessons.durationSeconds,
  videoUrl: lessons.videoUrl,
  documentUrl: lessons.documentUrl,
  preview: lessons.preview,
  mediaProvider: lessons.mediaProvider,
  mediaRef: lessons.mediaRef,
  createdAt: lessons.createdAt,
};

export async function getAdminCourseCurriculum(courseId: string) {
  return withLearningCache(`admin:course:${courseId}:curriculum`, async () => {
    const [modules, lessonRows] = await Promise.all([
      db.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.position)),
      db.select(adminLessonCurriculumColumns).from(lessons).where(eq(lessons.courseId, courseId)).orderBy(asc(lessons.position)),
    ]);
    return { modules, lessons: lessonRows };
  });
}

export function invalidateAdminCourseCurriculumCache(courseId: string) {
  memoryCache.delete(`admin:course:${courseId}:curriculum`);
  import("@/server/cache/redis").then(({ getRedis }) => getRedis()).then((r) => r?.del(`admin:course:${courseId}:curriculum`)).catch(() => {});
}

export async function getAdminCourseAssessments(courseId: string) {
  const assessments = await db.select().from(learningAssessment).where(eq(learningAssessment.courseId, courseId)).orderBy(desc(learningAssessment.updatedAt));
  const questions = assessments.length ? await db.select({
    id: learningQuestion.id, assessmentId: learningQuestion.assessmentId, promptFr: learningQuestion.promptFr,
    promptAr: learningQuestion.promptAr, type: learningQuestion.type, position: learningQuestion.position, points: learningQuestion.points,
    explanationFr: learningQuestion.explanationFr, explanationAr: learningQuestion.explanationAr,
  }).from(learningQuestion).where(inArray(learningQuestion.assessmentId, assessments.map((item) => item.id))).orderBy(asc(learningQuestion.position)) : [];
  const options = questions.length ? await db.select({
    id: learningQuestionOption.id,
    questionId: learningQuestionOption.questionId,
    textFr: learningQuestionOption.textFr,
    textAr: learningQuestionOption.textAr,
    position: learningQuestionOption.position,
    isCorrect: learningQuestionOption.isCorrect,
  }).from(learningQuestionOption)
    .where(inArray(learningQuestionOption.questionId, questions.map((item) => item.id)))
    .orderBy(asc(learningQuestionOption.position)) : [];
  const attemptCounts = assessments.length ? await db.select({
    assessmentId: learningAttempt.assessmentId,
    value: count(),
  }).from(learningAttempt)
    .where(inArray(learningAttempt.assessmentId, assessments.map((item) => item.id)))
    .groupBy(learningAttempt.assessmentId) : [];
  return assessments.map((assessment) => ({
    ...assessment,
    attemptCount: Number(attemptCounts.find((row) => row.assessmentId === assessment.id)?.value ?? 0),
    questions: questions.filter((question) => question.assessmentId === assessment.id).map((question) => ({
      ...question,
      options: options.filter((option) => option.questionId === question.id),
    })),
  }));
}

export async function getAdminCoursePublicationSummary(courseId: string) {
  const result = await db.execute<{ modules: number; lessons: number; assessments: number }>(sql`
    select
      (select count(*)::int from course_modules where course_id = ${courseId}) as modules,
      (select count(*)::int from lessons where course_id = ${courseId}) as lessons,
      (select count(*)::int from learning_assessment where course_id = ${courseId}) as assessments
  `);
  return result.rows[0] ?? { modules: 0, lessons: 0, assessments: 0 };
}

export async function getAdminAssessmentList(limit = 50) {
  return db.select({ assessment: learningAssessment, course: { id: courses.id, titleFr: courses.titleFr, titleAr: courses.titleAr },
    questions: sql<number>`(select count(*)::int from learning_question q where q.assessment_id = ${learningAssessment.id})`,
    attempts: sql<number>`(select count(*)::int from learning_attempt a where a.assessment_id = ${learningAssessment.id})`,
  })
    .from(learningAssessment).innerJoin(courses, eq(learningAssessment.courseId, courses.id))
    .orderBy(desc(learningAssessment.updatedAt)).limit(Math.min(100, Math.max(1, limit)));
}

export async function getAdminResultList(limit = 50) {
  return db.select({
    attempt: learningAttempt,
    student: { id: user.id, name: user.name, email: user.email },
    assessment: { id: learningAssessment.id, titleFr: learningAssessment.titleFr, titleAr: learningAssessment.titleAr },
    course: { id: courses.id, titleFr: courses.titleFr, titleAr: courses.titleAr },
  }).from(learningAttempt)
    .innerJoin(user, eq(learningAttempt.userId, user.id))
    .innerJoin(learningAssessment, eq(learningAttempt.assessmentId, learningAssessment.id))
    .innerJoin(courses, eq(learningAssessment.courseId, courses.id))
    .where(eq(learningAttempt.status, "GRADED"))
    .orderBy(desc(learningAttempt.submittedAt)).limit(Math.min(100, Math.max(1, limit)));
}

export async function getAdminAssessmentAnalytics(limit = 50) {
  const assessmentLimit = Math.min(100, Math.max(1, limit));
  const studentLimit = Math.min(200, Math.max(1, limit * 4));
  const [assessmentRows, studentRows, summaryRows] = await Promise.all([
    db.execute<{
      id: string; title_fr: string; title_ar: string; course_title_fr: string; course_title_ar: string;
      published: boolean; questions: number; participants: number; attempts: number; average_score: number; pass_rate: number; best_score: number;
    }>(sql`
      select a.id, a.title_fr, a.title_ar, c.title_fr as course_title_fr, c.title_ar as course_title_ar, a.published,
        (select count(*)::int from learning_question q where q.assessment_id = a.id) as questions,
        count(distinct t.user_id) filter (where t.status = 'GRADED')::int as participants,
        count(t.id) filter (where t.status = 'GRADED')::int as attempts,
        coalesce(round(avg(t.percentage) filter (where t.status = 'GRADED')), 0)::int as average_score,
        coalesce(round(100.0 * count(t.id) filter (where t.status = 'GRADED' and t.passed) / nullif(count(t.id) filter (where t.status = 'GRADED'), 0)), 0)::int as pass_rate,
        coalesce(max(t.percentage) filter (where t.status = 'GRADED'), 0)::int as best_score
      from learning_assessment a
      join courses c on c.id = a.course_id
      left join learning_attempt t on t.assessment_id = a.id
      group by a.id, c.id
      order by a.updated_at desc
      limit ${assessmentLimit}
    `),
    db.execute<{
      assessment_id: string; assessment_title_fr: string; assessment_title_ar: string; user_id: string; student_name: string; student_email: string;
      attempts: number; best_score: number; latest_score: number; latest_passed: boolean; completed_at: Date;
    }>(sql`
      select a.id as assessment_id, a.title_fr as assessment_title_fr, a.title_ar as assessment_title_ar,
        u.id as user_id, u.name as student_name, u.email as student_email,
        count(t.id)::int as attempts, max(t.percentage)::int as best_score,
        (array_agg(t.percentage order by t.submitted_at desc))[1]::int as latest_score,
        (array_agg(t.passed order by t.submitted_at desc))[1] as latest_passed,
        max(t.submitted_at) as completed_at
      from learning_attempt t
      join learning_assessment a on a.id = t.assessment_id
      join "user" u on u.id = t.user_id
      where t.status = 'GRADED'
      group by a.id, u.id
      order by completed_at desc
      limit ${studentLimit}
    `),
    db.execute<{ assessments: number; attempts: number; average_score: number; pass_rate: number }>(sql`
      select
        (select count(*)::int from learning_assessment) as assessments,
        count(*) filter (where status = 'GRADED')::int as attempts,
        coalesce(round(avg(percentage) filter (where status = 'GRADED')), 0)::int as average_score,
        coalesce(round(100.0 * count(*) filter (where status = 'GRADED' and passed) / nullif(count(*) filter (where status = 'GRADED'), 0)), 0)::int as pass_rate
      from learning_attempt
    `),
  ]);
  return {
    assessments: assessmentRows.rows,
    students: studentRows.rows,
    summary: summaryRows.rows[0] ?? { assessments: 0, attempts: 0, average_score: 0, pass_rate: 0 },
    scope: { assessmentLimit, studentLimit },
  };
}

export async function getCrmLearnerOperationalDetail(organizationId: string, contactId: string) {
  const [contact] = await db.select({
    id: crmContact.id, linkedUserId: crmContact.linkedUserId,
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    profile: { phone: userProfile.phoneNumber, phoneVerifiedAt: userProfile.phoneVerifiedAt, locale: userProfile.preferredLocale, country: userProfile.country, governorate: userProfile.governorate, city: userProfile.city, completedAt: userProfile.onboardingCompletedAt },
  }).from(crmContact)
    .leftJoin(user, eq(crmContact.linkedUserId, user.id))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId))).limit(1);
  if (!contact) return null;
  if (!contact.linkedUserId) return { contact, personas: [], enrollments: [], appointments: [], attempts: [], certificates: [] };
  const userId = contact.linkedUserId;
  const [personas, enrollmentRows, appointments, attempts, certificateRows] = await Promise.all([
    db.select({ persona: personaMembership.persona, status: personaMembership.status, primary: personaMembership.isPrimary }).from(personaMembership).where(eq(personaMembership.userId, userId)),
    db.select({ enrollment: enrollments, course: { titleFr: courses.titleFr, titleAr: courses.titleAr }, completedLessons: sql<number>`count(${lessonProgress.id}) filter (where ${lessonProgress.completed})::int` })
      .from(enrollments).innerJoin(courses, eq(enrollments.courseId, courses.id)).leftJoin(lessonProgress, eq(lessonProgress.enrollmentId, enrollments.id))
      .where(eq(enrollments.userId, userId)).groupBy(enrollments.id, courses.id).orderBy(desc(enrollments.enrolledAt)).limit(30),
    db.select().from(appointment).where(and(eq(appointment.contactId, contactId), eq(appointment.organizationId, organizationId))).orderBy(desc(appointment.startAt)).limit(30),
    db.select({ attempt: learningAttempt, assessment: { titleFr: learningAssessment.titleFr, titleAr: learningAssessment.titleAr } }).from(learningAttempt).innerJoin(learningAssessment, eq(learningAttempt.assessmentId, learningAssessment.id)).where(eq(learningAttempt.userId, userId)).orderBy(desc(learningAttempt.startedAt)).limit(30),
    db.select({ certificate: certificates, course: { titleFr: courses.titleFr, titleAr: courses.titleAr } }).from(certificates).innerJoin(courses, eq(certificates.courseId, courses.id)).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt)).limit(30),
  ]);
  return { contact, personas, enrollments: enrollmentRows, appointments, attempts, certificates: certificateRows };
}

export type AdminEnrollmentItem = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  course_id: string;
  course_title_fr: string;
  course_title_ar: string;
  progress_percent: number;
  status: string;
  enrolled_at: Date | string;
  completed_at: Date | string | null;
};

export async function getAdminEnrollmentsList(params: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = (page - 1) * limit;
  const q = params.q?.trim();
  const status = params.status?.trim();

  const searchFilter = q ? sql`and (u.name ilike ${`%${q}%`} or u.email ilike ${`%${q}%`} or c.title_fr ilike ${`%${q}%`} or c.title_ar ilike ${`%${q}%`})` : sql``;
  const statusFilter = status && status !== "all" ? sql`and e.status = ${status}` : sql``;

  const [itemsRes, totalRes, statsRes] = await Promise.all([
    db.execute<AdminEnrollmentItem>(sql`
      select 
        e.id, e.user_id, u.name as user_name, u.email as user_email,
        c.id as course_id, c.title_fr as course_title_fr, c.title_ar as course_title_ar,
        e.progress_percent, e.status, e.enrolled_at, e.completed_at
      from enrollments e
      join "user" u on u.id = e.user_id
      join courses c on c.id = e.course_id
      where 1=1 ${searchFilter} ${statusFilter}
      order by e.enrolled_at desc
      limit ${limit} offset ${offset}
    `),
    db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from enrollments e
      join "user" u on u.id = e.user_id
      join courses c on c.id = e.course_id
      where 1=1 ${searchFilter} ${statusFilter}
    `),
    db.execute<{ total: number; active: number; completed: number; avg_progress: number }>(sql`
      select 
        count(*)::int as total,
        count(*) filter (where status = 'active')::int as active,
        count(*) filter (where status = 'completed')::int as completed,
        coalesce(round(avg(progress_percent)), 0)::int as avg_progress
      from enrollments
    `),
  ]);

  const total = totalRes.rows[0]?.count ?? 0;
  const stats = statsRes.rows[0] ?? { total: 0, active: 0, completed: 0, avg_progress: 0 };

  return {
    items: itemsRes.rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export type AdminCertificateItem = {
  id: string;
  code: string;
  file_url: string | null;
  issued_at: Date | string;
  user_id: string;
  user_name: string;
  user_email: string;
  course_id: string;
  course_title_fr: string;
  course_title_ar: string;
};

export async function getAdminCertificatesList(params: {
  q?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = (page - 1) * limit;
  const q = params.q?.trim();

  const searchFilter = q ? sql`and (cert.code ilike ${`%${q}%`} or u.name ilike ${`%${q}%`} or u.email ilike ${`%${q}%`} or c.title_fr ilike ${`%${q}%`} or c.title_ar ilike ${`%${q}%`})` : sql``;

  const [itemsRes, totalRes] = await Promise.all([
    db.execute<AdminCertificateItem>(sql`
      select 
        cert.id, cert.code, cert.file_url, cert.issued_at,
        cert.user_id, u.name as user_name, u.email as user_email,
        c.id as course_id, c.title_fr as course_title_fr, c.title_ar as course_title_ar
      from certificates cert
      join "user" u on u.id = cert.user_id
      join courses c on c.id = cert.course_id
      where 1=1 ${searchFilter}
      order by cert.issued_at desc
      limit ${limit} offset ${offset}
    `),
    db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from certificates cert
      join "user" u on u.id = cert.user_id
      join courses c on c.id = cert.course_id
      where 1=1 ${searchFilter}
    `),
  ]);

  const total = totalRes.rows[0]?.count ?? 0;

  return {
    items: itemsRes.rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

