import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { enrollments } from "@/server/db/schema";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLiveSessionById, hasUserAttendedSession } from "@/server/queries/live";
import { StudentLiveRoom, type StudentLiveRoomData } from "@/components/student/StudentLiveRoom";
import type { LiveSessionEmbedMode, LiveSessionProvider, LiveSessionStatus } from "@/server/db/schema";
import type { Locale } from "@/types";

export const dynamic = "force-dynamic";

export default async function LearnerLiveRoomPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireUser(locale);
  const liveSession = await getLiveSessionById(id);
  if (!liveSession) notFound();

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));

  // Access control: If course specific, ensure active enrollment
  if (liveSession.scope === "COURSE_SPECIFIC" && liveSession.courseId && !isAdmin) {
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, liveSession.courseId),
          eq(enrollments.userId, session.user.id),
          eq(enrollments.status, "active")
        )
      )
      .limit(1);

    if (!enrollment) {
      redirect(`/${locale}/dashboard?error=access_restricted`);
    }
  }

  const hasAttended = await hasUserAttendedSession(id, session.user.id);

  const initialSession: StudentLiveRoomData = {
    id: liveSession.id,
    titleFr: liveSession.titleFr,
    titleAr: liveSession.titleAr,
    descriptionFr: liveSession.descriptionFr,
    descriptionAr: liveSession.descriptionAr,
    provider: liveSession.provider as LiveSessionProvider,
    embedMode: liveSession.embedMode as LiveSessionEmbedMode,
    scope: liveSession.scope,
    courseId: liveSession.courseId,
    courseTitleFr: liveSession.courseTitleFr,
    courseTitleAr: liveSession.courseTitleAr,
    status: liveSession.status as LiveSessionStatus,
    scheduledStartAt: liveSession.scheduledStartAt,
    durationMinutes: liveSession.durationMinutes,
    isBroadcastPushed: liveSession.isBroadcastPushed,
    attendeeCount: liveSession.attendeeCount,
    directEmbedUrl:
      liveSession.status === "LIVE_NOW" && liveSession.embedMode === "IFRAME_EMBED"
        ? liveSession.externalMeetingUrl
        : null,
  };

  return (
    <StudentLiveRoom
      locale={locale as Locale}
      initialSession={initialSession}
      initialHasAttended={hasAttended}
    />
  );
}
