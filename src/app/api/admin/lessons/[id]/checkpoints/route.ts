import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { db } from "@/server/db";
import { auditLogs, lessons } from "@/server/db/schema";
import { createCheckpoint, getLessonCheckpoints } from "@/server/services/video-checkpoints";

const idSchema = z.string().uuid();
const optionSchema = z.object({ id: z.string().min(1).max(40), textFr: z.string().min(1).max(280), textAr: z.string().min(1).max(280) });
const schema = z.object({
  triggerSeconds: z.number().int().min(0).max(86400),
  kind: z.enum(["REFLECTION", "QUIZ"]),
  promptFr: z.string().trim().min(3).max(500),
  promptAr: z.string().trim().min(3).max(500),
  options: z.array(optionSchema).min(2).max(6).optional(),
  correctOptionId: z.string().min(1).max(40).optional(),
  position: z.number().int().min(0).max(999).optional(),
}).strict().refine((value) => value.kind !== "QUIZ" || (value.options && value.options.length >= 2), { message: "QUIZ checkpoints need at least two options" })
  .refine((value) => value.kind !== "QUIZ" || Boolean(value.correctOptionId), { message: "QUIZ checkpoints need a correctOptionId" })
  .refine((value) => value.kind !== "QUIZ" || !value.correctOptionId || (value.options ?? []).some((option) => option.id === value.correctOptionId), { message: "correctOptionId must match one of the options" });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const checkpoints = await getLessonCheckpoints(id.data);
  return NextResponse.json({ checkpoints });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const [lesson] = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, id.data)).limit(1);
  if (!lesson) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const checkpoint = await createCheckpoint(id.data, parsed.data);
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "admin.lesson.checkpoint.create", entityType: "video_checkpoint", entityId: checkpoint.id, metadata: { lessonId: id.data } });
  return NextResponse.json({ checkpoint }, { status: 201 });
}
