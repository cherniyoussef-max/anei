import { notFound, redirect } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getDashboardData, getLearnerAppointments, getLearningCourse } from "@/server/queries/account";
import { getUserPersonas } from "@/server/queries/personas";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";
import { StudentDashboard } from "@/components/student/StudentDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);

  // Normal users are checked for persona portal routing; admins/super-admins are permitted to preview the learner space
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));
  if (!isAdmin) {
    const memberships = await getUserPersonas(session.user.id);
    const primary = memberships.find((row) => row.isPrimary);
    if (primary && primary.persona !== "STUDENT") {
      if (primary.status === "ACTIVE") redirect(`/${locale}${personaPortalPath[primary.persona as Persona]}`);
      redirect(`/${locale}/pending-review`);
    }
  }

  const ar = locale === "ar";
  const [data, appointments] = await Promise.all([
    getDashboardData(session.user.id),
    getLearnerAppointments(session.user.id, false, 4),
  ]);

  const continueRow = data.enrollmentRows.find(({ enrollment }) => enrollment.progressPercent < 100) ?? data.enrollmentRows[0];
  const averageProgress = data.enrollmentRows.length
    ? Math.round(data.enrollmentRows.reduce((total, row) => total + row.enrollment.progressPercent, 0) / data.enrollmentRows.length)
    : 0;

  let activeDetails: {
    moduleTitle?: string;
    lessonTitle?: string;
    remainingMinutes?: number;
    completedLessonsCount?: number;
    totalLessonsCount?: number;
  } = {};

  if (continueRow) {
    try {
      const activeCourseData = await getLearningCourse(session.user.id, continueRow.course.slug);
      if (activeCourseData && activeCourseData.lessons.length > 0) {
        const completedSet = new Set(activeCourseData.progress.filter((p) => p.completed).map((p) => p.lessonId));
        const currentLesson = activeCourseData.lessons.find((l) => !completedSet.has(l.id)) ?? activeCourseData.lessons[0];
        const currentModule = currentLesson ? activeCourseData.modules.find((m) => m.id === currentLesson.moduleId) : null;
        const totalLessonsCount = activeCourseData.lessons.length;
        const completedLessonsCount = completedSet.size;
        const remainingCount = Math.max(0, totalLessonsCount - completedLessonsCount);
        const remainingMinutes = remainingCount > 0 ? remainingCount * 12 : undefined;

        activeDetails = {
          moduleTitle: currentModule ? (ar ? currentModule.titleAr : currentModule.titleFr) : undefined,
          lessonTitle: currentLesson ? (ar ? currentLesson.titleAr : currentLesson.titleFr) : undefined,
          remainingMinutes,
          completedLessonsCount,
          totalLessonsCount,
        };
      }
    } catch {
      // Graceful fallback if course details query fails
    }
  }

  return (
    <StudentDashboard
      locale={locale}
      userName={session.user.name}
      completedLessonsTotal={data.completedLessonsTotal}
      continueItem={continueRow ? {
        id: continueRow.enrollment.id,
        slug: continueRow.course.slug,
        title: ar ? continueRow.course.titleAr : continueRow.course.titleFr,
        category: continueRow.course.category,
        coverImage: continueRow.course.coverImage,
        progress: continueRow.enrollment.progressPercent,
        status: continueRow.enrollment.status,
        ...activeDetails,
      } : undefined}
      averageProgress={averageProgress}
      courses={data.enrollmentRows.map(({ enrollment, course }) => ({
        id: enrollment.id,
        slug: course.slug,
        title: ar ? course.titleAr : course.titleFr,
        category: course.category,
        coverImage: course.coverImage,
        progress: enrollment.progressPercent,
        status: enrollment.status,
      }))}
      sessions={[
        ...appointments.map((appointment) => ({
          id: appointment.id,
          title: ar ? "موعد متابعة بيداغوجية" : "Entretien de suivi pédagogique",
          date: formatDate(appointment.startAt, locale),
          startAtRaw: appointment.startAt.toISOString(),
          trainer: appointment.assignedToName || (ar ? "المشرف الأكاديمي" : "Tuteur pédagogique ANEI"),
          meetingUrl: appointment.meetingUrl ?? undefined,
          type: "appointment" as const,
        })),
        ...data.upcomingWebinars.map(({ webinar }) => ({
          id: webinar.id,
          title: ar ? webinar.titleAr : webinar.titleFr,
          date: formatDate(webinar.startsAt, locale),
          startAtRaw: webinar.startsAt.toISOString(),
          trainer: webinar.trainerName || (ar ? "المكوّن" : "Formateur expert"),
          meetingUrl: webinar.meetingUrl ?? undefined,
          type: "webinar" as const,
        })),
      ].slice(0, 3)}
      resources={data.purchaseRows.flatMap(({ purchase, resource }) => resource ? [{
        id: resource.id,
        title: ar ? resource.titleAr : resource.titleFr,
        date: formatDate(purchase.grantedAt, locale),
        type: resource.type,
        description: ar ? resource.descriptionAr : resource.descriptionFr,
      }] : [])}
      certificates={data.certificateRows.map(({ certificate, course }) => ({
        id: certificate.id,
        title: ar ? course.titleAr : course.titleFr,
        code: certificate.code,
        date: formatDate(certificate.issuedAt, locale),
      }))}
    />
  );
}
