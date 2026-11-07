import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { saveChunk, finalizeChunkedUpload } from "@/server/storage/app-storage";
import { db } from "@/server/db";
import { videoAssets, lessons } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403, headers: noStore });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM_DATA" }, { status: 400, headers: noStore });
  }

  const uploadId = String(formData.get("uploadId") || "").trim();
  const chunkIndex = parseInt(String(formData.get("chunkIndex") || "0"), 10);
  const totalChunks = parseInt(String(formData.get("totalChunks") || "1"), 10);
  const category = String(formData.get("category") || "video").replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = String(formData.get("filename") || "media.mp4");
  const contentType = String(formData.get("contentType") || "video/mp4");
  const lessonId = formData.get("lessonId") ? String(formData.get("lessonId")) : null;
  const courseId = formData.get("courseId") ? String(formData.get("courseId")) : null;
  const durationSeconds = formData.get("durationSeconds") ? parseInt(String(formData.get("durationSeconds")), 10) : 0;

  const chunkFile = formData.get("chunk");
  if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || !chunkFile || !(chunkFile instanceof Blob)) {
    return NextResponse.json({ error: "INVALID_CHUNK_PARAMETERS" }, { status: 400, headers: noStore });
  }

  const chunkArrayBuffer = await chunkFile.arrayBuffer();
  const chunkBuffer = Buffer.from(chunkArrayBuffer);

  // 1. Save the chunk
  await saveChunk({
    uploadId,
    chunkIndex,
    totalChunks,
    data: chunkBuffer,
  });

  // 2. If not the last chunk, acknowledge receipt
  if (chunkIndex < totalChunks - 1) {
    return NextResponse.json(
      {
        complete: false,
        chunkIndex,
        totalChunks,
        uploadId,
      },
      { status: 200, headers: noStore },
    );
  }

  // 3. Last chunk received — Finalize and assemble the complete file
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const extMatch = sanitizedFilename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : "";
  const datePrefix = new Date().toISOString().slice(0, 10);
  const objectKey = `${category}/${datePrefix}/${uploadId}${ext}`;

  try {
    const finalizedFile = await finalizeChunkedUpload({
      uploadId,
      objectKey,
      category,
      filename,
      contentType,
    });

    const fileUrl = `/api/storage/files/${finalizedFile.objectKey}`;

    // 4. If this is a video asset, sync with video_assets table and lesson
    if (category === "video" || contentType.startsWith("video/")) {
      const mockUid = uploadId.replace(/-/g, "").slice(0, 32);
      const [vAsset] = await db
        .insert(videoAssets)
        .values({
          lessonId: lessonId || null,
          courseId: courseId || null,
          provider: "LOCAL_DEV",
          cloudflareUid: mockUid,
          originalFilename: filename,
          fileSizeBytes: finalizedFile.fileSize,
          mimeType: contentType,
          status: "READY",
          encodingProgressPercent: 100,
          durationSeconds: durationSeconds || 720,
          playbackHlsUrl: fileUrl,
          thumbnailUrl: "/demo/video-poster.svg",
          requireSignedUrls: false,
          uploadedByAdminId: session.user.id,
        })
        .onConflictDoUpdate({
          target: videoAssets.cloudflareUid,
          set: {
            status: "READY",
            playbackHlsUrl: fileUrl,
            fileSizeBytes: finalizedFile.fileSize,
            durationSeconds: durationSeconds || 720,
            updatedAt: new Date(),
          },
        })
        .returning();

      // If attached to a lesson, update lesson immediately
      if (lessonId) {
        await db
          .update(lessons)
          .set({
            mediaProvider: "internal",
            videoUrl: fileUrl,
            mediaRef: mockUid,
            durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
          })
          .where(eq(lessons.id, lessonId));
      }

      logger.info("chunked_upload.video_completed", {
        uploadId,
        objectKey: finalizedFile.objectKey,
        fileSize: finalizedFile.fileSize,
        assetId: vAsset?.id,
        lessonId,
      });

      return NextResponse.json(
        {
          complete: true,
          objectKey: finalizedFile.objectKey,
          fileUrl,
          filename: finalizedFile.filename,
          fileSize: finalizedFile.fileSize,
          assetId: vAsset?.id,
          uid: mockUid,
          durationSeconds: durationSeconds || 720,
        },
        { status: 201, headers: noStore },
      );
    }

    return NextResponse.json(
      {
        complete: true,
        objectKey: finalizedFile.objectKey,
        fileUrl,
        filename: finalizedFile.filename,
        fileSize: finalizedFile.fileSize,
      },
      { status: 201, headers: noStore },
    );
  } catch (err) {
    logger.error("chunked_upload.finalize_failed", { uploadId, error: String(err) });
    return NextResponse.json({ error: "FINALIZE_FAILED" }, { status: 500, headers: noStore });
  }
}
