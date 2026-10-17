import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { enrollments, liveSessions } from "@/server/db/schema";
import { getFreshSession } from "@/server/auth/session";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { recordLiveAttendance } from "@/server/queries/live";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });

  const session = await getFreshSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rate = await consumeRateLimit(`live-join:${session.user.id}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  // Strict Impersonation block: Support admins previewing student accounts cannot create attendances
  if (await isImpersonationActive(request.headers)) {
    return NextResponse.json(
      {
        error: "IMPERSONATION_READ_ONLY",
        message: "Action bloquée en mode prévisualisation support.",
      },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [liveSession] = await db.select().from(liveSessions).where(eq(liveSessions.id, id)).limit(1);
  if (!liveSession) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));

  // Live status validation: URL is confidential until session is LIVE_NOW
  if (liveSession.status !== "LIVE_NOW" && !isAdmin) {
    return NextResponse.json(
      {
        error: "LIVE_NOT_STARTED",
        message: "Le webinaire n'a pas encore démarré. Veuillez attendre l'ouverture de la salle.",
      },
      { status: 403 }
    );
  }

  // Scope check: If course-specific, learner must have active enrollment
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
        {
          error: "COURSE_ENROLLMENT_REQUIRED",
          message: "Ce direct est réservé aux apprenants inscrits à la formation.",
        },
        { status: 403 }
      );
    }
  }

  // Attendance tracking
  await recordLiveAttendance({
    sessionId: id,
    userId: session.user.id,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    externalMeetingUrl: liveSession.externalMeetingUrl,
    embedMode: liveSession.embedMode,
    provider: liveSession.provider,
  });
}
