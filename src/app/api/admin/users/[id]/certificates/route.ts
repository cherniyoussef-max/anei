import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { invalidateAdminUserCaches } from "@/server/cache/admin-users";
import { db } from "@/server/db";
import { auditLogs, certificates, courses, enrollments, user } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const certSchema = z
  .object({
    courseId: z.string().min(1).max(64),
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
  const parsed = certSchema.safeParse(await readLimitedJson(request).catch(() => null));
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

    // Check if certificate already exists
    const [existingCert] = await tx
      .select({ id: certificates.id, code: certificates.code })
      .from(certificates)
      .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)))
      .limit(1);

    if (existingCert) {
      return { kind: "already_issued" as const, code: existingCert.code };
    }

    // Ensure enrollment exists and is completed
    const [existingEnrollment] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (existingEnrollment) {
      await tx
        .update(enrollments)
        .set({ progressPercent: 100, status: "completed", completedAt: new Date() })
        .where(eq(enrollments.id, existingEnrollment.id));
    } else {
      await tx.insert(enrollments).values({
        userId,
        courseId,
        status: "completed",
        progressPercent: 100,
        source: "ADMIN",
        enrolledAt: new Date(),
        completedAt: new Date(),
      });
    }

    const code = `ANEI-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const [inserted] = await tx
      .insert(certificates)
      .values({
        userId,
        courseId,
        code,
        issuedAt: new Date(),
      })
      .returning({ id: certificates.id, code: certificates.code });

    await tx.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "user.certificate.issue_manual",
      entityType: "certificates",
      entityId: inserted.id,
      metadata: { userId, courseId, code: inserted.code, title: targetCourse.titleFr },
    });

    return { kind: "ok" as const, code: inserted.code };
  });

  if (result.kind === "user_not_found") return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  if (result.kind === "course_not_found") return NextResponse.json({ error: "COURSE_NOT_FOUND" }, { status: 404 });
  if (result.kind === "already_issued") return NextResponse.json({ error: "ALREADY_ISSUED", code: result.code }, { status: 409 });

  await invalidateAdminUserCaches(userId);

  return NextResponse.json({ ok: true, code: result.code });
}
