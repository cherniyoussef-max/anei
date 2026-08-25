import { notFound, redirect } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getDashboardData, getLearnerAppointments } from "@/server/queries/account";
import { getUserPersonas } from "@/server/queries/personas";
import { getPointsBalance } from "@/server/services/points";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";
import { StudentDashboard } from "@/components/student/StudentDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);

  if (["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role))) redirect(`/${locale}/admin`);

  const memberships = await getUserPersonas(session.user.id);
  const primary = memberships.find((row) => row.isPrimary);
  if (primary && primary.persona !== "STUDENT") {
    if (primary.status === "ACTIVE") redirect(`/${locale}${personaPortalPath[primary.persona as Persona]}`);
    redirect(`/${locale}/pending-review`);
  }

  const ar = locale === "ar";
  const [data, appointments, pointsBalance] = await Promise.all([getDashboardData(session.user.id), getLearnerAppointments(session.user.id, false, 2), getPointsBalance(session.user.id)]);
  const continueRow = data.enrollmentRows.find(({ enrollment }) => enrollment.progressPercent < 100) ?? data.enrollmentRows[0];
  const averageProgress = data.enrollmentRows.length
    ? Math.round(data.enrollmentRows.reduce((total, row) => total + row.enrollment.progressPercent, 0) / data.enrollmentRows.length)
    : 0;

  return (
    <StudentDashboard
      locale={locale}
      userName={session.user.name}
      pointsBalance={pointsBalance}
      continueItem={continueRow ? {
        id: continueRow.enrollment.id,
        slug: continueRow.course.slug,
        title: ar ? continueRow.course.titleAr : continueRow.course.titleFr,
        progress: continueRow.enrollment.progressPercent,
      } : undefined}
      averageProgress={averageProgress}
      courses={data.enrollmentRows.map(({ enrollment, course }) => ({
        id: enrollment.id,
        slug: course.slug,
        title: ar ? course.titleAr : course.titleFr,
        progress: enrollment.progressPercent,
      }))}
      sessions={[...appointments.map((appointment) => ({
          id: appointment.id,
          title: ar ? "موعد متابعة" : "Rendez-vous de suivi",
          date: formatDate(appointment.startAt, locale),
          trainer: appointment.assignedToName,
        })), ...data.upcomingWebinars.map(({ webinar }) => ({
          id: webinar.id,
          title: ar ? webinar.titleAr : webinar.titleFr,
          date: formatDate(webinar.startsAt, locale),
          trainer: webinar.trainerName,
          meetingUrl: webinar.meetingUrl ?? undefined,
        }))].slice(0, 2)}
      resources={data.purchaseRows.flatMap(({ purchase, resource }) => resource ? [{
        id: resource.id,
        title: ar ? resource.titleAr : resource.titleFr,
        date: formatDate(purchase.grantedAt, locale),
      }] : [])}
      certificates={data.certificateRows.map(({ certificate, course }) => ({
        id: certificate.id,
        title: ar ? course.titleAr : course.titleFr,
        code: certificate.code,
      }))}
    />
  );
}
