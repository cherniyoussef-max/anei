import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { deleteLearningQuestion } from "@/server/services/learning-assessments";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("assessments.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const { id, questionId } = await params;
  const assessmentId = z.string().uuid().safeParse(id);
  const parsedQuestionId = z.string().uuid().safeParse(questionId);
  if (!assessmentId.success || !parsedQuestionId.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const result = await deleteLearningQuestion(session.user.id, assessmentId.data, parsedQuestionId.data);
  const status = result.kind === "ok" ? 200 : result.kind === "not_found" ? 404 : 409;
  return NextResponse.json(result.kind === "ok" ? { ok: true } : { error: result.kind.toUpperCase() }, { status });
}
