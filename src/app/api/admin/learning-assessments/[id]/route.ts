import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { deleteLearningAssessment, updateLearningAssessment } from "@/server/services/learning-assessments";

const updateSchema = z.object({
  titleFr: z.string().trim().min(3).max(180),
  titleAr: z.string().trim().min(3).max(180),
  instructionsFr: z.string().trim().max(4000),
  instructionsAr: z.string().trim().max(4000),
  timeLimitSeconds: z.number().int().min(60).max(14400),
  passingScore: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().min(1).max(10),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("assessments.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const id = z.string().uuid().safeParse((await params).id);
  const input = updateSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !input.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await updateLearningAssessment(session.user.id, id.data, input.data);
  const status = result.kind === "ok" ? 200 : result.kind === "not_found" ? 404 : 409;
  return NextResponse.json(result.kind === "ok" ? result : { error: result.kind.toUpperCase() }, { status });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("assessments.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const result = await deleteLearningAssessment(session.user.id, id.data);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, archived: result.archived });
}
