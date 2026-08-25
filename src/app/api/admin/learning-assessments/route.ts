import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { createLearningAssessment } from "@/server/services/learning-assessments";

const schema = z.object({
  courseId: z.string().uuid(), moduleId: z.string().uuid().nullable().optional(),
  titleFr: z.string().trim().min(3).max(180), titleAr: z.string().trim().min(3).max(180),
  instructionsFr: z.string().trim().max(4000).default(""), instructionsAr: z.string().trim().max(4000).default(""),
  timeLimitSeconds: z.number().int().min(60).max(14400), passingScore: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().min(1).max(10),
}).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("assessments.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const result = await createLearningAssessment(session.user.id, parsed.data);
  return result.kind === "ok" ? NextResponse.json(result, { status: 201 }) : NextResponse.json({ error: "COURSE_NOT_FOUND" }, { status: 404 });
}
