import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { deleteLearningQuestion, updateLearningQuestion } from "@/server/services/learning-assessments";

const schema = z.object({
  promptFr: z.string().trim().min(2).max(2000), promptAr: z.string().trim().min(2).max(2000),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
  position: z.number().int().min(1).max(1000), points: z.number().int().min(1).max(100),
  explanationFr: z.string().trim().max(2000).nullable().optional(), explanationAr: z.string().trim().max(2000).nullable().optional(),
  options: z.array(z.object({ textFr: z.string().trim().min(1).max(500), textAr: z.string().trim().min(1).max(500), position: z.number().int().min(1).max(20), isCorrect: z.boolean() }).strict()).min(2).max(20),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("assessments.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const { id, questionId } = await params;
  const assessmentId = z.string().uuid().safeParse(id);
  const parsedQuestionId = z.string().uuid().safeParse(questionId);
  const input = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!assessmentId.success || !parsedQuestionId.success || !input.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await updateLearningQuestion(session.user.id, assessmentId.data, parsedQuestionId.data, input.data);
  const status = result.kind === "ok" ? 200 : result.kind === "not_found" ? 404 : 409;
  return NextResponse.json(result.kind === "ok" ? result : { error: result.kind.toUpperCase() }, { status });
}

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
