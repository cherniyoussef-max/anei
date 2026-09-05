import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";
import { recordCheckpointResponse } from "@/server/services/video-checkpoints";

const idSchema = z.string().uuid();
const schema = z.object({
  responseText: z.string().trim().max(2000).optional(),
  selectedOptionId: z.string().min(1).max(40).optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string; checkpointId: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`checkpoint:${session.user.id}`, 120, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const checkpointId = idSchema.safeParse((await params).checkpointId);
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!checkpointId.success || !parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await recordCheckpointResponse(session.user.id, checkpointId.data, parsed.data);
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ ok: true, correct: result.correct });
}
