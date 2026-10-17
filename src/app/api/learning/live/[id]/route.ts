import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { enrollments } from "@/server/db/schema";
import { getFreshSession } from "@/server/auth/session";
import { getLiveSessionById, hasUserAttendedSession } from "@/server/queries/live";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFreshSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const liveSession = await getLiveSessionById(id);
  if (!liveSession) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));

  // Access validation: Course-specific sessions require enrollment unless admin
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
      return NextResponse.json(
        { error: "COURSE_ENROLLMENT_REQUIRED", message: "Ce direct est réservé aux apprenants inscrits à la formation." },
        { status: 403 }
      );
    }
  }

  const hasAttended = await hasUserAttendedSession(id, session.user.id);

  // Confidentiality: Mask external meeting URL until user officially joins via /join
  // (and if Jitsi embed, it will be loaded inside the room component once started)
  const safeSession = {
    id: liveSession.id,
    titleFr: liveSession.titleFr,
    titleAr: liveSession.titleAr,
    descriptionFr: liveSession.descriptionFr,
    descriptionAr: liveSession.descriptionAr,
    provider: liveSession.provider,
    embedMode: liveSession.embedMode,
    scope: liveSession.scope,
    courseId: liveSession.courseId,
    courseTitleFr: liveSession.courseTitleFr,
    courseTitleAr: liveSession.courseTitleAr,
    status: liveSession.status,
    scheduledStartAt: liveSession.scheduledStartAt,
    durationMinutes: liveSession.durationMinutes,
    isBroadcastPushed: liveSession.isBroadcastPushed,
    attendeeCount: liveSession.attendeeCount,
    // Only disclose external URL directly for Jitsi embed when live is ongoing
    directEmbedUrl:
      liveSession.status === "LIVE_NOW" && liveSession.embedMode === "IFRAME_EMBED"
        ? liveSession.externalMeetingUrl
        : null,
  };

  return NextResponse.json({ ok: true, session: safeSession, hasAttended });
}
