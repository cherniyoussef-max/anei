import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { uploadedFiles, uploadedFileChunks } from "@/server/db/schema";
import { getAdminSession } from "@/server/auth/admin";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";

const noStore = { "Cache-Control": "private, no-store" } as const;

const completeSchema = z.object({
  fileId: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403, headers: noStore });
  }

  const adminSession = await getAdminSession();
  const userSession = !adminSession ? await getSession() : null;
  const activeUser = adminSession?.user ?? userSession?.user;

  if (!activeUser) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: noStore });
  }

  const rate = await consumeRateLimit(`chunk-upload-complete:${activeUser.id}`, 60, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = completeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });
  }

  const { fileId, durationSeconds } = parsed.data;

  const [fileRecord] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  if (!fileRecord) {
    return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404, headers: noStore });
  }

  // Verify all chunks are present
  const countRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(uploadedFileChunks)
    .where(eq(uploadedFileChunks.fileId, fileId));

  const uploadedCount = countRes[0]?.count || 0;
  if (uploadedCount < fileRecord.totalChunks) {
    return NextResponse.json(
      {
        error: "INCOMPLETE_UPLOAD",
        message: `Only ${uploadedCount} of ${fileRecord.totalChunks} chunks uploaded.`,
      },
      { status: 400, headers: noStore },
    );
  }

  const finalDuration = durationSeconds && durationSeconds > 0 ? durationSeconds : fileRecord.durationSeconds;

  const [updated] = await db
    .update(uploadedFiles)
    .set({
      isComplete: true,
      uploadedChunks: uploadedCount,
      durationSeconds: finalDuration,
      updatedAt: new Date(),
    })
    .where(eq(uploadedFiles.id, fileId))
    .returning();

  const isVideo = updated.category === "video" || updated.mimeType.startsWith("video/");
  const primaryUrl = isVideo ? `/api/storage/stream/${updated.id}` : `/api/storage/files/${updated.id}`;

  return NextResponse.json(
    {
      success: true,
      fileId: updated.id,
      url: primaryUrl,
      streamUrl: `/api/storage/stream/${updated.id}`,
      downloadUrl: `/api/storage/files/${updated.id}`,
      filename: updated.filename,
      mimeType: updated.mimeType,
      fileSizeBytes: updated.fileSizeBytes,
      durationSeconds: updated.durationSeconds,
    },
    { status: 200, headers: noStore },
  );
}
