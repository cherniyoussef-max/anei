import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, courses } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const patchSchema = z.object({
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  priceMillimes: z.number().int().nonnegative().max(100_000_000).optional(),
  titleFr: z.string().trim().min(3).max(180).optional(),
  titleAr: z.string().trim().min(3).max(180).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

async function validatedId(params: Promise<{ id: string }>) {
  return idSchema.safeParse((await params).id);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = await validatedId(params);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = patchSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const [course] = await db.update(courses).set({ ...parsed.data, updatedAt: new Date() }).where(eq(courses.id, id.data)).returning();
  if (!course) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "course.update", entityType: "course", entityId: id.data, metadata: parsed.data });
  return NextResponse.json({ course });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.delete");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = await validatedId(params);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const [course] = await db.update(courses).set({ published: false, featured: false, updatedAt: new Date() }).where(eq(courses.id, id.data)).returning({ id: courses.id });
  if (!course) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "course.archive", entityType: "course", entityId: id.data });
  return NextResponse.json({ ok: true });
}
