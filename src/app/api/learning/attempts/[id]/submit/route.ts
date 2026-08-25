import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { submitLearningAttempt } from "@/server/services/learning-assessments";
import { consumeRateLimit } from "@/server/security/rate-limit";

const schema = z.object({ answers: z.array(z.object({ questionId: z.string().uuid(), optionIds: z.array(z.string().uuid()).min(1).max(20) }).strict()).min(1).max(200) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`learning-attempt-submit:${session.user.id}`, 30, 60, { fallbackLimit: 12 });
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const id = z.string().uuid().safeParse((await params).id);
  const body = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await submitLearningAttempt(session.user.id, id.data, body.data.answers);
  const status = result.kind === "ok" ? 200 : result.kind === "expired" ? 409 : result.kind === "forbidden" ? 403 : 400;
  return NextResponse.json(result.kind === "ok" ? { attempt: result.attempt, idempotent: result.idempotent } : { error: result.kind.toUpperCase() }, { status });
}
