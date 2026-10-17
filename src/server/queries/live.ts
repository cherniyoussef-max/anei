import "server-only";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  courses,
  enrollments,
  liveAttendances,
  liveSessions,
  user,
  type LiveSessionEmbedMode,
  type LiveSessionProvider,
  type LiveSessionRow,
  type LiveSessionScope,
  type LiveSessionStatus,
} from "@/server/db/schema";

export interface AdminLiveSessionItem extends LiveSessionRow {
  attendeeCount: number;
  courseTitleFr: string | null;
  courseTitleAr: string | null;
  createdByName: string | null;
}

export async function getLiveSessionsForAdmin(options: {
  status?: LiveSessionStatus;
  scope?: LiveSessionScope;
} = {}): Promise<AdminLiveSessionItem[]> {
  const conditions = [];
  if (options.status) conditions.push(eq(liveSessions.status, options.status));
  if (options.scope) conditions.push(eq(liveSessions.scope, options.scope));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      session: liveSessions,
      attendeeCount: count(liveAttendances.id),
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
      createdByName: user.name,
    })
    .from(liveSessions)
    .leftJoin(liveAttendances, eq(liveAttendances.sessionId, liveSessions.id))
    .leftJoin(courses, eq(courses.id, liveSessions.courseId))
    .leftJoin(user, eq(user.id, liveSessions.createdById))
    .where(whereClause)
    .groupBy(
      liveSessions.id,
      courses.titleFr,
      courses.titleAr,
      user.name
    )
    .orderBy(desc(liveSessions.scheduledStartAt));

  return rows.map((r) => ({
    ...r.session,
    attendeeCount: Number(r.attendeeCount ?? 0),
    courseTitleFr: r.courseTitleFr,
    courseTitleAr: r.courseTitleAr,
    createdByName: r.createdByName,
  }));
}

export async function getLiveSessionById(id: string) {
  const [row] = await db
    .select({
      session: liveSessions,
      attendeeCount: count(liveAttendances.id),
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
      createdByName: user.name,
    })
    .from(liveSessions)
    .leftJoin(liveAttendances, eq(liveAttendances.sessionId, liveSessions.id))
    .leftJoin(courses, eq(courses.id, liveSessions.courseId))
    .leftJoin(user, eq(user.id, liveSessions.createdById))
    .where(eq(liveSessions.id, id))
    .groupBy(
      liveSessions.id,
      courses.titleFr,
      courses.titleAr,
      user.name
    )
    .limit(1);

  if (!row) return null;

  return {
    ...row.session,
    attendeeCount: Number(row.attendeeCount ?? 0),
    courseTitleFr: row.courseTitleFr,
    courseTitleAr: row.courseTitleAr,
    createdByName: row.createdByName,
  };
}

export async function getLiveSessionAttendees(sessionId: string) {
  return await db
    .select({
      id: liveAttendances.id,
      joinedAt: liveAttendances.joinedAt,
      userAgent: liveAttendances.userAgent,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    })
    .from(liveAttendances)
    .innerJoin(user, eq(user.id, liveAttendances.userId))
    .where(eq(liveAttendances.sessionId, sessionId))
    .orderBy(desc(liveAttendances.joinedAt));
}

/**
 * Public/Learner safe session payload.
 * NEVER includes externalMeetingUrl prior to live room join!
 */
export interface LearnerLiveSessionSummary {
  id: string;
  titleFr: string;
  titleAr: string;
  descriptionFr: string | null;
  descriptionAr: string | null;
  provider: LiveSessionProvider;
  embedMode: LiveSessionEmbedMode;
  scope: LiveSessionScope;
  courseId: string | null;
  courseTitleFr: string | null;
  courseTitleAr: string | null;
  courseSlug?: string | null;
  category?: string;
  speakerName: string | null;
  replayUrl: string | null;
  status: LiveSessionStatus;
  scheduledStartAt: Date;
  durationMinutes: number;
  isBroadcastPushed: boolean;
  hasUserAttended?: boolean;
}

export async function getLiveSessionsForLearner(userId: string): Promise<LearnerLiveSessionSummary[]> {
  // 1. Get user's active course enrollments
  const userEnrollments = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.status, "active")));

  const enrolledCourseIds = userEnrollments.map((e) => e.courseId);

  // 2. Query sessions: either GLOBAL_WEBINAR or COURSE_SPECIFIC matching enrolledCourseIds
  const conditions = [
    inArray(liveSessions.status, ["SCHEDULED", "LIVE_NOW", "ENDED"]),
    or(
      eq(liveSessions.scope, "GLOBAL_WEBINAR"),
      enrolledCourseIds.length > 0
        ? and(eq(liveSessions.scope, "COURSE_SPECIFIC"), inArray(liveSessions.courseId, enrolledCourseIds))
        : sql`FALSE`
    ),
  ];

  const rows = await db
    .select({
      id: liveSessions.id,
      titleFr: liveSessions.titleFr,
      titleAr: liveSessions.titleAr,
      descriptionFr: liveSessions.descriptionFr,
      descriptionAr: liveSessions.descriptionAr,
      provider: liveSessions.provider,
      embedMode: liveSessions.embedMode,
      scope: liveSessions.scope,
      courseId: liveSessions.courseId,
      speakerName: liveSessions.speakerName,
      replayUrl: liveSessions.replayUrl,
      status: liveSessions.status,
      scheduledStartAt: liveSessions.scheduledStartAt,
      durationMinutes: liveSessions.durationMinutes,
      isBroadcastPushed: liveSessions.isBroadcastPushed,
      category: liveSessions.category,
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
      courseSlug: courses.slug,
    })
    .from(liveSessions)
    .leftJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(and(...conditions))
    .orderBy(desc(liveSessions.scheduledStartAt));

  return rows.map((r) => ({
    id: r.id,
    titleFr: r.titleFr,
    titleAr: r.titleAr,
    descriptionFr: r.descriptionFr,
    descriptionAr: r.descriptionAr,
    provider: r.provider as LiveSessionProvider,
    embedMode: r.embedMode as LiveSessionEmbedMode,
    scope: r.scope as LiveSessionScope,
    courseId: r.courseId,
    courseTitleFr: r.courseTitleFr,
    courseTitleAr: r.courseTitleAr,
    courseSlug: r.courseSlug,
    category: r.category,
    speakerName: r.speakerName,
    replayUrl: r.replayUrl,
    status: r.status as LiveSessionStatus,
    scheduledStartAt: r.scheduledStartAt,
    durationMinutes: r.durationMinutes,
    isBroadcastPushed: r.isBroadcastPushed,
  }));
}

/**
 * Returns any live sessions currently active and pushed to all users.
 * externalMeetingUrl is explicitly omitted for security.
 */
export async function getPushedLiveWebinars(): Promise<LearnerLiveSessionSummary[]> {
  const rows = await db
    .select({
      id: liveSessions.id,
      titleFr: liveSessions.titleFr,
      titleAr: liveSessions.titleAr,
      descriptionFr: liveSessions.descriptionFr,
      descriptionAr: liveSessions.descriptionAr,
      provider: liveSessions.provider,
      embedMode: liveSessions.embedMode,
      scope: liveSessions.scope,
      courseId: liveSessions.courseId,
      speakerName: liveSessions.speakerName,
      replayUrl: liveSessions.replayUrl,
      status: liveSessions.status,
      scheduledStartAt: liveSessions.scheduledStartAt,
      durationMinutes: liveSessions.durationMinutes,
      isBroadcastPushed: liveSessions.isBroadcastPushed,
      category: liveSessions.category,
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
      courseSlug: courses.slug,
    })
    .from(liveSessions)
    .leftJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(and(eq(liveSessions.status, "LIVE_NOW"), eq(liveSessions.isBroadcastPushed, true)))
    .orderBy(desc(liveSessions.scheduledStartAt))
    .limit(3);

  return rows.map((r) => ({
    id: r.id,
    titleFr: r.titleFr,
    titleAr: r.titleAr,
    descriptionFr: r.descriptionFr,
    descriptionAr: r.descriptionAr,
    provider: r.provider as LiveSessionProvider,
    embedMode: r.embedMode as LiveSessionEmbedMode,
    scope: r.scope as LiveSessionScope,
    courseId: r.courseId,
    courseTitleFr: r.courseTitleFr,
    courseTitleAr: r.courseTitleAr,
    courseSlug: r.courseSlug,
    category: r.category,
    speakerName: r.speakerName,
    replayUrl: r.replayUrl,
    status: r.status as LiveSessionStatus,
    scheduledStartAt: r.scheduledStartAt,
    durationMinutes: r.durationMinutes,
    isBroadcastPushed: r.isBroadcastPushed,
  }));
}

export async function hasUserAttendedSession(sessionId: string, userId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: liveAttendances.id })
    .from(liveAttendances)
    .where(and(eq(liveAttendances.sessionId, sessionId), eq(liveAttendances.userId, userId)))
    .limit(1);

  return Boolean(existing);
}

export async function recordLiveAttendance(params: {
  sessionId: string;
  userId: string;
  userAgent?: string | null;
}) {
  await db
    .insert(liveAttendances)
    .values({
      sessionId: params.sessionId,
      userId: params.userId,
      userAgent: params.userAgent ?? null,
    })
    .onConflictDoNothing({
      target: [liveAttendances.sessionId, liveAttendances.userId],
    });
}
