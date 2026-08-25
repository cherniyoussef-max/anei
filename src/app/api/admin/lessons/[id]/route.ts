import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, courseModules, lessons } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { lessonMediaReferenceSchema, mediaProviderSchema, resolveMediaRef, InvalidLessonMediaError } from "@/server/services/lesson-media";

const idSchema = z.string().uuid();
const patchSchema = z.object({
  titleFr: z.string().trim().min(2).max(180).optional(),
  titleAr: z.string().trim().min(2).max(180).optional(),
  descriptionFr: z.string().max(3000).optional(),
  descriptionAr: z.string().max(3000).optional(),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  preview: z.boolean().optional(),
  mediaProvider: mediaProviderSchema.optional(),
  mediaRef: z.string().min(1).max(2048).nullable().optional(),
  videoUrl: lessonMediaReferenceSchema.nullable().optional(),
  documentUrl: lessonMediaReferenceSchema.nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(1).max(1000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

/**
 * Existing lesson media compatibility: an admin converts a legacy `internal`
 * lesson to `youtube`/`cloudflare_stream` here (or edits Stream/YouTube
 * references on an existing lesson). mediaProvider/preview may arrive
 * independently, so resolveMediaRef is always evaluated against the merged
 * (existing row + patch) values, not the patch alone.
 */
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

  const [existing] = await db.select().from(lessons).where(eq(lessons.id, id.data)).limit(1);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (parsed.data.moduleId) {
    const [module] = await db.select({ id: courseModules.id }).from(courseModules).where(and(eq(courseModules.id, parsed.data.moduleId), eq(courseModules.courseId, existing.courseId))).limit(1);
    if (!module) return NextResponse.json({ error: "MODULE_NOT_FOUND" }, { status: 404 });
  }

  const nextProvider = parsed.data.mediaProvider ?? existing.mediaProvider;
  const nextPreview = parsed.data.preview ?? existing.preview;
  const rawMediaRef = parsed.data.mediaRef !== undefined ? parsed.data.mediaRef : existing.mediaRef;

  let mediaRef: string | null;
  try {
    mediaRef = resolveMediaRef(nextProvider as "internal" | "youtube" | "cloudflare_stream", rawMediaRef, nextPreview);
  } catch (error) {
    return NextResponse.json({ error: error instanceof InvalidLessonMediaError ? error.message : "INVALID_MEDIA" }, { status: 400 });
  }

  const { position: nextPosition, ...rest } = parsed.data;
  const lesson = await db.transaction(async (tx) => {
    if (nextPosition !== undefined && nextPosition !== existing.position) {
      // Reordering swap — see the identical pattern and rationale in
      // /api/admin/modules/[id]/route.ts.
      const TEMP_OFFSET = 1_000_000;
      const [occupant] = await tx
        .select({ id: lessons.id })
        .from(lessons)
        .where(and(eq(lessons.courseId, existing.courseId), eq(lessons.position, nextPosition)));
      if (occupant) {
        await tx.update(lessons).set({ position: TEMP_OFFSET + nextPosition }).where(eq(lessons.id, occupant.id));
      }
      await tx.update(lessons).set({ ...rest, mediaProvider: nextProvider, mediaRef, position: nextPosition }).where(eq(lessons.id, id.data));
      if (occupant) {
        await tx.update(lessons).set({ position: existing.position }).where(eq(lessons.id, occupant.id));
      }
      const [updated] = await tx.select().from(lessons).where(eq(lessons.id, id.data));
      return updated;
    }
    const [updated] = await tx.update(lessons).set({ ...rest, mediaProvider: nextProvider, mediaRef }).where(eq(lessons.id, id.data)).returning();
    return updated;
  });
  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "lesson.update",
    entityType: "lesson",
    entityId: id.data,
    metadata: { mediaProvider: nextProvider, mediaRefChanged: rawMediaRef !== existing.mediaRef },
  });
  return NextResponse.json({ lesson });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const [lesson] = await db.delete(lessons).where(eq(lessons.id, id.data)).returning({ id: lessons.id, courseId: lessons.courseId });
  if (!lesson) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "lesson.delete", entityType: "lesson", entityId: id.data, metadata: { courseId: lesson.courseId } });
  return NextResponse.json({ ok: true });
}
