import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
  coverImage: courses.coverImage,
  updatedAt: courses.updatedAt,
};

export async function getAdminCourseList(limit = 50) {
  const result = await db.execute<{
    id:string;slug:string;title_fr:string;title_ar:string;category:string;level:string;mode:string;
    price_millimes:number;published:boolean;updated_at:Date;enrollments:number;completion_rate:number;
  }>(sql`select c.id,c.slug,c.title_fr,c.title_ar,c.category,c.level,c.mode,c.price_millimes,c.published,c.updated_at,
    count(e.id)::int enrollments,
    coalesce(round(avg(e.progress_percent)),0)::int completion_rate
    from courses c left join enrollments e on e.course_id=c.id
    group by c.id order by c.updated_at desc limit ${Math.min(100, Math.max(1, limit))}`);
  return result.rows;
}

export async function getAdminCourseEditorBase(courseId: string) {
  const [course] = await db.select(adminCourseEditorColumns).from(courses).where(eq(courses.id, courseId)).limit(1);
  return course ?? null;
}

export async function getAdminCourseCurriculum(courseId: string) {
  const [modules, lessonRows] = await Promise.all([
    db.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.position)),
    db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(asc(lessons.position)),
  ]);
  return { modules, lessons: lessonRows };
}

export async function getAdminCourseAssessments(courseId: string) {
  const assessments = await db.select().from(learningAssessment).where(eq(learningAssessment.courseId, courseId)).orderBy(desc(learningAssessment.updatedAt));
  const questions = assessments.length ? await db.select({
    id: learningQuestion.id, assessmentId: learningQuestion.assessmentId, promptFr: learningQuestion.promptFr,
    promptAr: learningQuestion.promptAr, type: learningQuestion.type, position: learningQuestion.position, points: learningQuestion.points,
  }).from(learningQuestion).where(inArray(learningQuestion.assessmentId, assessments.map((item) => item.id))).orderBy(asc(learningQuestion.position)) : [];
  return assessments.map((assessment) => ({
    ...assessment,
    questions: questions.filter((question) => question.assessmentId === assessment.id),
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
