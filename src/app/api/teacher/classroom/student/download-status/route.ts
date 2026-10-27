import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { teacherClassroomStudents } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getOrCreateTeacherClassroom } from "@/server/services/inclusive-ecosystem";

const downloadStatusSchema = z.object({
  studentId: z.string().optional(),
  all: z.boolean().optional(),
  downloadStatus: z.enum(["A_TELECHARGER", "TELECHARGE"]).default("TELECHARGE"),
});

export async function PATCH(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (await isImpersonationActive(await headers())) {
    return NextResponse.json({ ok: false, error: "MUTATION_BLOCKED_IN_IMPERSONATION" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`teacher-download-status:${session.user.id}`, 60, 60, { fallbackLimit: 30 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = downloadStatusSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { studentId, all, downloadStatus } = parsed.data;
  const { classroom } = await getOrCreateTeacherClassroom(session.user.id);

  if (all) {
    await db
      .update(teacherClassroomStudents)
      .set({
        downloadStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(teacherClassroomStudents.classroomId, classroom.id),
          eq(teacherClassroomStudents.teacherUserId, session.user.id)
        )
      );

    return NextResponse.json({ ok: true, status: downloadStatus, all: true });
  }

  if (!studentId) {
    return NextResponse.json({ ok: false, error: "STUDENT_ID_REQUIRED" }, { status: 400 });
  }

  const [updated] = await db
    .update(teacherClassroomStudents)
    .set({
      downloadStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teacherClassroomStudents.id, studentId),
        eq(teacherClassroomStudents.teacherUserId, session.user.id)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ ok: false, error: "STUDENT_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, student: updated });
}
