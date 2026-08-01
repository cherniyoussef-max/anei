import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { auditLogs, courseModules, courses, lessons } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSession } from "@/server/auth/admin";
import { and, eq } from "drizzle-orm";
import { isTrustedMutation } from "@/server/security/origin";
import { env } from "@/server/env";
import { readLimitedJson } from "@/server/security/request-body";

const mediaReference = z.string().min(1).max(2048).refine((value) => {
  const localOrHttps = value.startsWith("/") || /^https:\/\//i.test(value);
  const privateObjectKey = /^[a-zA-Z0-9._\/-]+$/.test(value) && !value.startsWith("/") && !value.includes("..");
  if (env.NODE_ENV === "production" && env.STORAGE_PROVIDER === "s3-compatible") return privateObjectKey;
  return localOrHttps || privateObjectKey;
}, "Use a private object key in production, or a local/HTTPS path in development");
const schema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(1).max(1000),
  titleFr: z.string().min(2).max(180),
  titleAr: z.string().min(2).max(180),
  descriptionFr: z.string().max(3000).default(""),
  descriptionAr: z.string().max(3000).default(""),
  durationSeconds: z.number().int().min(0).max(86400),
  videoUrl: mediaReference.nullable().optional(),
  documentUrl: mediaReference.nullable().optional(),
  preview: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, parsed.data.courseId) });
  if (!course) return NextResponse.json({ error: "COURSE_NOT_FOUND" }, { status: 404 });
  if (parsed.data.moduleId) {
    const [module] = await db.select({ id: courseModules.id }).from(courseModules).where(and(eq(courseModules.id, parsed.data.moduleId), eq(courseModules.courseId, parsed.data.courseId))).limit(1);
    if (!module) return NextResponse.json({ error: "MODULE_NOT_FOUND" }, { status: 404 });
  }
  try {
    const [lesson] = await db.insert(lessons).values(parsed.data).returning();
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "lesson.create", entityType: "lesson", entityId: lesson.id, metadata: { courseId: lesson.courseId } });
    return NextResponse.json({ lesson }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "POSITION_ALREADY_USED" }, { status: 409 });
  }
}
