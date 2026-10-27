import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { teacherEvaluations } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getOrCreateTeacherClassroom } from "@/server/services/inclusive-ecosystem";

export const DEFAULT_SAMPLE_TEST = {
  title: "Évaluation de français : lecture et compréhension",
  durationMinutes: 45,
  questions: [
    {
      full: "Lis attentivement le texte, puis relève trois verbes conjugués au passé composé dans les deux premiers paragraphes.",
      simple: "Lis le texte. Trouve 3 verbes au passé composé.",
      icon: "1",
    },
    {
      full: "Explique avec tes propres mots pourquoi le personnage principal décide de quitter son village à l'aube.",
      simple: "Pourquoi le personnage quitte-t-il son village ? Écris 1 phrase simple.",
      icon: "2",
    },
    {
      full: "Recopie la phrase correcte parmi les propositions suivantes et justifie ton choix grammatical.",
      simple: "Choisis la phrase correcte. Entoure ton choix.",
      icon: "3",
    },
    {
      full: "Rédige un court paragraphe de cinq lignes décrivant ton lieu préféré en utilisant au moins deux adjectifs qualificatifs.",
      simple: "Décris ton lieu préféré. Écris 3 phrases courtes.",
      icon: "4",
    },
  ],
};

const evaluationSaveSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(255),
  durationMinutes: z.number().int().min(1).max(300).default(30),
  questions: z.array(
    z.object({
      full: z.string().min(1),
      simple: z.string().min(1),
      icon: z.string().default("1"),
    })
  ).min(1),
});

export async function GET(_request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { classroom } = await getOrCreateTeacherClassroom(session.user.id);

  let [evaluation] = await db
    .select()
    .from(teacherEvaluations)
    .where(eq(teacherEvaluations.classroomId, classroom.id))
    .orderBy(desc(teacherEvaluations.updatedAt))
    .limit(1);

  if (!evaluation) {
    const [created] = await db
      .insert(teacherEvaluations)
      .values({
        classroomId: classroom.id,
        teacherUserId: session.user.id,
        title: DEFAULT_SAMPLE_TEST.title,
        durationMinutes: DEFAULT_SAMPLE_TEST.durationMinutes,
        questionsJson: DEFAULT_SAMPLE_TEST.questions,
      })
      .returning();
    evaluation = created;
  }

  return NextResponse.json({ ok: true, evaluation });
}

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

  const rate = await consumeRateLimit(`teacher-eval-save:${session.user.id}`, 30, 60, { fallbackLimit: 15 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = evaluationSaveSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { classroom } = await getOrCreateTeacherClassroom(session.user.id);
  const { id, title, durationMinutes, questions } = parsed.data;

  if (id) {
    const [existing] = await db
      .select({ id: teacherEvaluations.id })
      .from(teacherEvaluations)
      .where(
        and(
          eq(teacherEvaluations.id, id),
          eq(teacherEvaluations.teacherUserId, session.user.id)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(teacherEvaluations)
        .set({
          title,
          durationMinutes,
          questionsJson: questions,
          updatedAt: new Date(),
        })
        .where(eq(teacherEvaluations.id, id))
        .returning();

      return NextResponse.json({ ok: true, evaluation: updated });
    }
  }

  const [created] = await db
    .insert(teacherEvaluations)
    .values({
      classroomId: classroom.id,
      teacherUserId: session.user.id,
      title,
      durationMinutes,
      questionsJson: questions,
    })
    .returning();

  return NextResponse.json({ ok: true, evaluation: created });
}
