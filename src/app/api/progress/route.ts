import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { updateLessonProgress } from "@/server/services/progress";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({ lessonId: z.string().uuid(), watchedSeconds: z.number().int().nonnegative().max(24 * 60 * 60) });

export async function PUT(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`progress:${session.user.id}`, 120, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    return NextResponse.json(await updateLessonProgress({ userId: session.user.id, ...parsed.data }));
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
}
