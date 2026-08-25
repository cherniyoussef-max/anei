import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { publishLearningAssessment } from "@/server/services/learning-assessments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("assessments.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const id = z.string().uuid().safeParse((await params).id);
  const body = z.object({ published: z.boolean() }).strict().safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await publishLearningAssessment(session.user.id, id.data, body.data.published);
  return NextResponse.json(result.kind === "ok" ? result : { error: result.kind.toUpperCase() }, { status: result.kind === "ok" ? 200 : result.kind === "not_found" ? 404 : 409 });
}
