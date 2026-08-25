import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, courseModules } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const patchSchema = z.object({
  position: z.number().int().min(1).max(1000).optional(),
  titleFr: z.string().trim().min(2).max(180).optional(),
  titleAr: z.string().trim().min(2).max(180).optional(),
  descriptionFr: z.string().trim().max(2000).optional(),
  descriptionAr: z.string().trim().max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = patchSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const [existing] = await db.select().from(courseModules).where(eq(courseModules.id, id.data)).limit(1);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { position: nextPosition, ...rest } = parsed.data;
  const courseModule = await db.transaction(async (tx) => {
    if (nextPosition !== undefined && nextPosition !== existing.position) {
      // Reordering swap: a plain position update fails on the UNIQUE(course,
      // position) constraint whenever another module already holds the
      // target slot. Move that occupant to a safe out-of-range temp
      // position first, then this module into the target slot, then the
      // occupant into the slot this module vacated — one atomic swap
      // instead of forcing the admin to free the slot manually.
      const TEMP_OFFSET = 1_000_000;
      const [occupant] = await tx
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(and(eq(courseModules.courseId, existing.courseId), eq(courseModules.position, nextPosition)));
      if (occupant) {
        await tx.update(courseModules).set({ position: TEMP_OFFSET + nextPosition }).where(eq(courseModules.id, occupant.id));
      }
      await tx.update(courseModules).set({ ...rest, position: nextPosition }).where(eq(courseModules.id, id.data));
      if (occupant) {
        await tx.update(courseModules).set({ position: existing.position }).where(eq(courseModules.id, occupant.id));
      }
      const [updated] = await tx.select().from(courseModules).where(eq(courseModules.id, id.data));
      return updated;
    }
    const [updated] = await tx.update(courseModules).set(rest).where(eq(courseModules.id, id.data)).returning();
    return updated;
  });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "course_module.update", entityType: "course_module", entityId: id.data, metadata: { courseId: existing.courseId } });
  return NextResponse.json({ module: courseModule });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const [deletedModule] = await db.delete(courseModules).where(eq(courseModules.id, id.data)).returning({ id: courseModules.id, courseId: courseModules.courseId });
  if (!deletedModule) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "course_module.delete", entityType: "course_module", entityId: id.data, metadata: { courseId: deletedModule.courseId } });
  return NextResponse.json({ ok: true });
}
