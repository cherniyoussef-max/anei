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
import { computeRecommendedAdaptations, DifficultyKey } from "@/lib/inclusive-taxonomy";

const studentUpsertSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().min(1).max(100),
  difficulties: z.array(z.string()).default([]),
  adaptations: z.array(z.string()).optional(),
  personalNote: z.string().max(2000).default(""),
  downloadStatus: z.string().max(50).default("A_TELECHARGER"),
});

export async function POST(request: Request) {
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

  const rate = await consumeRateLimit(`teacher-student-upsert:${session.user.id}`, 60, 60, { fallbackLimit: 30 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = studentUpsertSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { classroom } = await getOrCreateTeacherClassroom(session.user.id);
  const { id, displayName, difficulties, personalNote, downloadStatus } = parsed.data;

  // Auto-compute recommended adaptations if not explicitly provided
  const adaptations = parsed.data.adaptations && parsed.data.adaptations.length > 0
    ? parsed.data.adaptations
    : computeRecommendedAdaptations(difficulties as DifficultyKey[]);

  if (id) {
    // Update existing student belonging to this teacher
    const [existing] = await db
      .select({ id: teacherClassroomStudents.id })
      .from(teacherClassroomStudents)
      .where(
        and(
          eq(teacherClassroomStudents.id, id),
          eq(teacherClassroomStudents.teacherUserId, session.user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ ok: false, error: "STUDENT_NOT_FOUND" }, { status: 404 });
    }

    const [updated] = await db
      .update(teacherClassroomStudents)
      .set({
        displayName,
        difficulties,
        adaptations,
        personalNote,
        downloadStatus,
        updatedAt: new Date(),
      })
      .where(eq(teacherClassroomStudents.id, id))
      .returning();

    return NextResponse.json({ ok: true, student: updated });
  }

  // Create new student
  const [created] = await db
    .insert(teacherClassroomStudents)
    .values({
      classroomId: classroom.id,
      teacherUserId: session.user.id,
      displayName,
      difficulties,
      adaptations,
      personalNote,
      downloadStatus,
    })
    .returning();

  return NextResponse.json({ ok: true, student: created }, { status: 201 });
}

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(request: Request) {
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

  const rate = await consumeRateLimit(`teacher-student-del:${session.user.id}`, 30, 60, { fallbackLimit: 15 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = deleteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  await db
    .delete(teacherClassroomStudents)
    .where(
      and(
        eq(teacherClassroomStudents.id, parsed.data.id),
        eq(teacherClassroomStudents.teacherUserId, session.user.id)
      )
    );

  return NextResponse.json({ ok: true });
}
