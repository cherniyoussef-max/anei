import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { createCourseDiscussionPost } from "@/server/services/course-discussion";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const bodySchema = z.object({
  body: z.string().trim().min(2).max(2000),
  parentId: z.string().uuid().nullable().optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const courseId = z.string().uuid().safeParse((await params).courseId);
  if (!courseId.success) return NextResponse.json({ error: "INVALID_COURSE" }, { status: 400 });
  const rate = await consumeRateLimit(`course-discussion:${session.user.id}`, 12, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await createCourseDiscussionPost(session.user.id, { courseId: courseId.data, ...parsed.data });
  if (result.kind === "not_entitled") return NextResponse.json({ error: "NOT_ENTITLED" }, { status: 403 });
  if (result.kind === "invalid_parent") return NextResponse.json({ error: "INVALID_PARENT" }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
