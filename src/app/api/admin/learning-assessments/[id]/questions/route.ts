import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { addLearningQuestion } from "@/server/services/learning-assessments";

const schema = z.object({
  promptFr: z.string().trim().min(2).max(2000), promptAr: z.string().trim().min(2).max(2000),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
  position: z.number().int().min(1).max(1000), points: z.number().int().min(1).max(100),
  explanationFr: z.string().trim().max(2000).nullable().optional(), explanationAr: z.string().trim().max(2000).nullable().optional(),
  options: z.array(z.object({ textFr: z.string().trim().min(1).max(500), textAr: z.string().trim().min(1).max(500), position: z.number().int().min(1).max(20), isCorrect: z.boolean() }).strict()).min(2).max(20),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("assessments.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const id = z.string().uuid().safeParse((await params).id);
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await addLearningQuestion(session.user.id, id.data, parsed.data);
  const status = result.kind === "ok" ? 201 : result.kind === "not_found" ? 404 : 409;
  return NextResponse.json(result.kind === "ok" ? result : { error: result.kind.toUpperCase() }, { status });
}
