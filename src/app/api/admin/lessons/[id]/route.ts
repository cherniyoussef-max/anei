import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, lessons } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { mediaProviderSchema, resolveMediaRef, InvalidLessonMediaError } from "@/server/services/lesson-media";

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

  const nextProvider = parsed.data.mediaProvider ?? existing.mediaProvider;
  const nextPreview = parsed.data.preview ?? existing.preview;
  const rawMediaRef = parsed.data.mediaRef !== undefined ? parsed.data.mediaRef : existing.mediaRef;

  let mediaRef: string | null;
  try {
    mediaRef = resolveMediaRef(nextProvider as "internal" | "youtube" | "cloudflare_stream", rawMediaRef, nextPreview);
  } catch (error) {
    return NextResponse.json({ error: error instanceof InvalidLessonMediaError ? error.message : "INVALID_MEDIA" }, { status: 400 });
  }

  const [lesson] = await db.update(lessons).set({
    ...parsed.data,
    mediaProvider: nextProvider,
    mediaRef,
  }).where(eq(lessons.id, id.data)).returning();
  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "lesson.update",
    entityType: "lesson",
    entityId: id.data,
    metadata: { mediaProvider: nextProvider, mediaRefChanged: rawMediaRef !== existing.mediaRef },
  });
  return NextResponse.json({ lesson });
}
