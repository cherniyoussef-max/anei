import { notFound, redirect } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getDashboardData, getLearnerAppointments, getLearningCourse } from "@/server/queries/account";
import { getLiveSessionsForLearner } from "@/server/queries/live";
import { getUserPersonas } from "@/server/queries/personas";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { avsBookingRequests, avsProfiles } from "@/server/db/schema";
import { StudentDashboard } from "@/components/student/StudentDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ view?: string; preview?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);

  // Normal users are checked for persona portal routing; admins/super-admins are permitted to preview the learner space via ?view=learner
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));
  const search = searchParams ? await searchParams : {};
  const isLearnerPreview = search?.view === "learner" || search?.preview === "true";

  if (isAdmin && !isLearnerPreview) {
    redirect(`/${locale}/admin`);
  }

  if (!isAdmin) {
    const memberships = await getUserPersonas(session.user.id);
    const primary = memberships.find((row) => row.isPrimary);
    if (primary && primary.persona !== "STUDENT") {
      if (primary.status === "ACTIVE") redirect(`/${locale}${personaPortalPath[primary.persona as Persona]}`);
      redirect(`/${locale}/pending-review`);
    }
  }

  const ar = locale === "ar";
  const [data, appointments, learnerLiveSessions, parentBookings] = await Promise.all([
    getDashboardData(session.user.id),
    getLearnerAppointments(session.user.id, false, 4),
    getLiveSessionsForLearner(session.user.id),
    db
      .select({
        id: avsBookingRequests.id,
        childName: avsBookingRequests.childName,
        requestedDate: avsBookingRequests.requestedDate,
        requestedTimeSlot: avsBookingRequests.requestedTimeSlot,
        meetingType: avsBookingRequests.meetingType,
        status: avsBookingRequests.status,
        liveSessionId: avsBookingRequests.liveSessionId,
        practitionerName: avsProfiles.displayName,
      })
      .from(avsBookingRequests)
      .innerJoin(avsProfiles, eq(avsBookingRequests.avsProfileId, avsProfiles.id))
      .where(
        and(
          eq(avsBookingRequests.parentUserId, session.user.id),
          inArray(avsBookingRequests.status, [
            "AWAITING_PRACTITIONER_CONFIRMATION",
            "PENDING",
            "CONFIRMED",
          ])
        )
      )
      .limit(6),
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
        ...learnerLiveSessions
          .filter((s) => s.status === "LIVE_NOW" || s.status === "SCHEDULED")
          .map((live) => ({
            id: live.id,
            title: ar ? live.titleAr : live.titleFr,
            date: formatDate(live.scheduledStartAt, locale),
            startAtRaw: live.scheduledStartAt.toISOString(),
            trainer: ar ? "فريق ANEI الأكاديمي" : "Équipe académique ANEI",
            meetingUrl: `/${locale}/learning/live/${live.id}`,
            type: "webinar" as const,
          })),
        ...appointments.map((appointment) => ({
          id: appointment.id,
          title: ar ? "موعد متابعة بيداغوجية" : "Entretien de suivi pédagogique",
          date: formatDate(appointment.startAt, locale),
          startAtRaw: appointment.startAt.toISOString(),
          trainer: appointment.assignedToName || (ar ? "المشرف الأكاديمي" : "Tuteur pédagogique ANEI"),
          meetingUrl: appointment.meetingUrl ?? undefined,
          type: "appointment" as const,
        })),
        ...parentBookings.map((b) => {
          const isPending =
            b.status === "AWAITING_PRACTITIONER_CONFIRMATION" || b.status === "PENDING";
          const isOnline = b.meetingType === "ONLINE" || b.meetingType === "ONLINE_VISIO";
          const statusBadge = isPending
            ? ar
              ? `في انتظار تأكيد ${b.practitionerName} : `
              : `En attente de confirmation par ${b.practitionerName} : `
            : "";

          const baseTitle = ar
            ? isOnline
              ? "استشارة عن بعد (فيديو)"
              : "موعد حضوري بالعيادة"
            : isOnline
            ? "Consultation Visio En Ligne"
            : "Séance en Cabinet / Présentiel";

          return {
            id: b.id,
            title: `${statusBadge}${baseTitle} (${b.childName})`,
            date: `${b.requestedDate} (${b.requestedTimeSlot})`,
            trainer: b.practitionerName,
            meetingUrl:
              isOnline && !isPending
                ? b.liveSessionId
                  ? `/${locale}/learning/live/${b.liveSessionId}`
                  : `https://meet.jit.si/anei-visio-${b.id.slice(0, 8)}`
                : undefined,
            type: "appointment" as const,
          };
        }),
        ...data.upcomingWebinars.map(({ webinar }) => ({
          id: webinar.id,
          title: ar ? webinar.titleAr : webinar.titleFr,
          date: formatDate(webinar.startsAt, locale),
          startAtRaw: webinar.startsAt.toISOString(),
          trainer: webinar.trainerName || (ar ? "المكوّن" : "Formateur expert"),
          meetingUrl: webinar.meetingUrl ?? undefined,
          type: "webinar" as const,
        })),
      ].slice(0, 4)}
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
