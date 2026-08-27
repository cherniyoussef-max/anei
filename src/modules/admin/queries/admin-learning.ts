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
