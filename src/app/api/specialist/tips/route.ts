import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { specialistClassroomTips } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function GET(_request: Request) {
  try {
    const tips = await db
      .select()
      .from(specialistClassroomTips)
      .where(eq(specialistClassroomTips.isPublished, true))
      .orderBy(desc(specialistClassroomTips.createdAt));

    return NextResponse.json({ ok: true, tips });
  } catch (error) {
    console.error("[SpecialistTips GET error]:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

const createTipSchema = z.object({
  difficultyKey: z.enum(["dys", "tdah", "vis", "aud", "tsa", "comp"]),
  situationTitle: z.string().min(5).max(300),
  whatToDo: z.string().min(5).max(1500),
  whatToAvoid: z.string().max(1500).default(""),
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

  const rate = await consumeRateLimit(`spec-tip:${session.user.id}`, 20, 60, { fallbackLimit: 10 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = createTipSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const [tip] = await db
    .insert(specialistClassroomTips)
    .values({
      authorSpecialistUserId: session.user.id,
      authorName: session.user.name || "Spécialiste Référent ANEI",
      difficultyKey: parsed.data.difficultyKey,
      situationTitle: parsed.data.situationTitle,
      whatToDo: parsed.data.whatToDo,
      whatToAvoid: parsed.data.whatToAvoid,
      isPublished: true,
    })
    .returning();

  return NextResponse.json({ ok: true, tip }, { status: 201 });
}
