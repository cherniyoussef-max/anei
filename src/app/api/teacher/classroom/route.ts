import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { teacherClassrooms } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getOrCreateTeacherClassroom } from "@/server/services/inclusive-ecosystem";

export async function GET(_request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const data = await getOrCreateTeacherClassroom(session.user.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[TeacherClassroom GET error]:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

const updateClassroomSchema = z.object({
  className: z.string().min(1).max(100).optional(),
  palettePreset: z.enum(["Classique", "Pastel", "Daltonien", "Personnalisée"]).optional(),
  customColorsJson: z.record(z.string(), z.string()).optional(),
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

  const rate = await consumeRateLimit(`teacher-classroom:${session.user.id}`, 30, 60, { fallbackLimit: 15 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = updateClassroomSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { classroom } = await getOrCreateTeacherClassroom(session.user.id);

  const [updated] = await db
    .update(teacherClassrooms)
    .set({
      ...(parsed.data.className ? { className: parsed.data.className } : {}),
      ...(parsed.data.palettePreset ? { palettePreset: parsed.data.palettePreset } : {}),
      ...(parsed.data.customColorsJson !== undefined ? { customColorsJson: parsed.data.customColorsJson } : {}),
      updatedAt: new Date(),
    })
    .where(eq(teacherClassrooms.id, classroom.id))
    .returning();

  return NextResponse.json({ ok: true, classroom: updated });
}
