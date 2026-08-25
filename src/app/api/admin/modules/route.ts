import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, courseModules, courses } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({
  courseId: z.string().uuid(),
  position: z.number().int().min(1).max(1000),
  titleFr: z.string().trim().min(2).max(180),
  titleAr: z.string().trim().min(2).max(180),
  descriptionFr: z.string().trim().max(2000).default(""),
  descriptionAr: z.string().trim().max(2000).default(""),
}).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, parsed.data.courseId)).limit(1);
  if (!course) return NextResponse.json({ error: "COURSE_NOT_FOUND" }, { status: 404 });
  const [duplicate] = await db.select({ id: courseModules.id }).from(courseModules).where(and(eq(courseModules.courseId, parsed.data.courseId), eq(courseModules.position, parsed.data.position))).limit(1);
  if (duplicate) return NextResponse.json({ error: "POSITION_ALREADY_USED" }, { status: 409 });
  const [module] = await db.insert(courseModules).values(parsed.data).returning();
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "course_module.create", entityType: "course_module", entityId: module.id, metadata: { courseId: module.courseId } });
  return NextResponse.json({ module }, { status: 201 });
}
