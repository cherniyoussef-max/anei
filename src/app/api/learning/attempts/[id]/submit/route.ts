import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { submitLearningAttempt } from "@/server/services/learning-assessments";
import { consumeRateLimit } from "@/server/security/rate-limit";

const schema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().uuid(),
            optionIds: z.array(z.string().uuid()).min(1).max(20),
          }).strict()
      )
      .max(200)
      .optional()
      .default([]),
    cheatingDetected: z.boolean().optional(),
    cheatingReason: z.string().max(100).optional(),
  }).strict()
  .refine(
    (data) => data.cheatingDetected || (data.answers && data.answers.length > 0),
    { message: "Either answers or cheatingDetected must be supplied" }
  );

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if ((session as unknown as { impersonation?: { active: boolean } }).impersonation?.active) {
    return NextResponse.json(
      { error: "IMPERSONATION_READ_ONLY", message: "Action bloquée en mode prévisualisation support." },
      { status: 403 }
    );
  }
  const rate = await consumeRateLimit(`learning-attempt-submit:${session.user.id}`, 30, 60, { fallbackLimit: 12 });
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const id = z.string().uuid().safeParse((await params).id);
  const body = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await submitLearningAttempt(session.user.id, id.data, body.data.answers, {
    cheatingDetected: body.data.cheatingDetected,
    reason: body.data.cheatingReason,
  });
  const status = result.kind === "ok" ? 200 : result.kind === "expired" ? 409 : result.kind === "forbidden" ? 403 : 400;
  return NextResponse.json(
    result.kind === "ok"
      ? {
          attempt: result.attempt,
          idempotent: result.idempotent,
          courseCompleted: result.courseCompleted,
          certificateCode: result.certificateCode,
        }
      : { error: result.kind.toUpperCase() },
    { status }
  );
}
