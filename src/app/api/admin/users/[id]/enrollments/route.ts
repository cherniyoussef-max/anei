import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { invalidateAdminUserCaches } from "@/server/cache/admin-users";
import { db } from "@/server/db";
import { auditLogs, courses, enrollments, user } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const postSchema = z
  .object({
    courseId: z.string().min(1).max(64),
  })
  .strict();

const patchSchema = z
  .object({
    enrollmentId: z.string().min(1).max(64),
    action: z.enum(["complete", "reset", "revoke"]),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSessionFor("users.manage");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const id = idSchema.safeParse((await params).id);
  const parsed = postSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const userId = id.data;
  const { courseId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [targetUser] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!targetUser) return { kind: "user_not_found" as const };

    const [targetCourse] = await tx
      .select({ id: courses.id, titleFr: courses.titleFr })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!targetCourse) return { kind: "course_not_found" as const };

    // Check existing enrollment
    const [existing] = await tx
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (existing) {
      if (existing.status === "cancelled") {
        const [reactivated] = await tx
          .update(enrollments)
          .set({ status: "active", source: "ADMIN" })
          .where(eq(enrollments.id, existing.id))
          .returning();
        await tx.insert(auditLogs).values({
          actorUserId: session.user.id,
          action: "user.enrollment.reactivate",
          entityType: "enrollments",
          entityId: reactivated.id,
          metadata: { userId, courseId, title: targetCourse.titleFr },
        });
        return { kind: "ok" as const, enrollment: reactivated };
      }
      return { kind: "already_enrolled" as const };
    }

    const [created] = await tx
      .insert(enrollments)
      .values({
        userId,
        courseId,
        status: "active",
        progressPercent: 0,
        source: "ADMIN",
        enrolledAt: new Date(),
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "user.enrollment.grant",
      entityType: "enrollments",
      entityId: created.id,
      metadata: { userId, courseId, title: targetCourse.titleFr, source: "ADMIN" },
    });

    return { kind: "ok" as const, enrollment: created };
  });

  if (result.kind === "user_not_found") return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  if (result.kind === "course_not_found") return NextResponse.json({ error: "COURSE_NOT_FOUND" }, { status: 404 });
  if (result.kind === "already_enrolled") return NextResponse.json({ error: "ALREADY_ENROLLED" }, { status: 409 });

  await invalidateAdminUserCaches(userId);

  return NextResponse.json({ ok: true, enrollment: result.enrollment });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSessionFor("users.manage");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const id = idSchema.safeParse((await params).id);
  const parsed = patchSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const userId = id.data;
  const { enrollmentId, action } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId)))
      .limit(1);

    if (!target) return { kind: "not_found" as const };

    if (action === "complete") {
      const [updated] = await tx
        .update(enrollments)
        .set({
          progressPercent: 100,
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(enrollments.id, enrollmentId))
        .returning();

      await tx.insert(auditLogs).values({
        actorUserId: session.user.id,
        action: "user.enrollment.override_complete",
        entityType: "enrollments",
        entityId: enrollmentId,
        metadata: { userId, courseId: target.courseId },
      });

      return { kind: "ok" as const, updated };
    }

    if (action === "reset") {
      const [updated] = await tx
        .update(enrollments)
        .set({
          progressPercent: 0,
          status: "active",
          completedAt: null,
        })
        .where(eq(enrollments.id, enrollmentId))
        .returning();

      await tx.insert(auditLogs).values({
        actorUserId: session.user.id,
        action: "user.enrollment.reset",
        entityType: "enrollments",
        entityId: enrollmentId,
        metadata: { userId, courseId: target.courseId },
      });

      return { kind: "ok" as const, updated };
    }

    if (action === "revoke") {
      await tx.delete(enrollments).where(eq(enrollments.id, enrollmentId));

      await tx.insert(auditLogs).values({
        actorUserId: session.user.id,
        action: "user.enrollment.revoke",
        entityType: "enrollments",
        entityId: enrollmentId,
        metadata: { userId, courseId: target.courseId },
      });

      return { kind: "ok" as const, revoked: true };
    }

    return { kind: "invalid_action" as const };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "ENROLLMENT_NOT_FOUND" }, { status: 404 });
  }

  await invalidateAdminUserCaches(userId);

  return NextResponse.json({ ok: true, result });
}
