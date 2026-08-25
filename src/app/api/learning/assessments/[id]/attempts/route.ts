import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { startLearningAttempt } from "@/server/services/learning-assessments";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`learning-attempt-start:${session.user.id}`, 20, 60, { fallbackLimit: 10 });
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const result = await startLearningAttempt(session.user.id, id.data);
  return NextResponse.json(result.kind === "ok" ? result : { error: result.kind.toUpperCase() }, { status: result.kind === "ok" ? 200 : result.kind === "max_attempts" ? 409 : 403 });
}
