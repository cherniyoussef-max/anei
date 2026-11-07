import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { uploadedFiles, uploadedFileChunks } from "@/server/db/schema";
import { getAdminSession } from "@/server/auth/admin";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";

const noStore = { "Cache-Control": "private, no-store" } as const;

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

  const rate = await consumeRateLimit(`chunk-upload:${activeUser.id}`, 600, 60, { fallbackLimit: 200 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const formData = await request.formData();
    const fileId = String(formData.get("fileId") || "").trim();
    const chunkIndex = Number(formData.get("chunkIndex"));
    const chunkFile = formData.get("chunk");

    if (!fileId || !Number.isInteger(chunkIndex) || chunkIndex < 0 || !(chunkFile instanceof Blob)) {
      return NextResponse.json({ error: "INVALID_CHUNK_PAYLOAD" }, { status: 400, headers: noStore });
    }

    const [fileRecord] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
    if (!fileRecord) {
      return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404, headers: noStore });
    }

    if (chunkIndex >= fileRecord.totalChunks) {
      return NextResponse.json({ error: "CHUNK_INDEX_OUT_OF_BOUNDS" }, { status: 400, headers: noStore });
    }

    const arrayBuffer = await chunkFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // Upsert chunk
    await db
      .insert(uploadedFileChunks)
      .values({
        fileId,
        chunkIndex,
        chunkData: base64Data,
        chunkSizeBytes: buffer.length,
      })
      .onConflictDoUpdate({
        target: [uploadedFileChunks.fileId, uploadedFileChunks.chunkIndex],
        set: {
          chunkData: base64Data,
          chunkSizeBytes: buffer.length,
        },
      });

    // Count chunks uploaded so far
    const countRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(uploadedFileChunks)
      .where(eq(uploadedFileChunks.fileId, fileId));

    const currentCount = countRes[0]?.count || 0;

    await db
      .update(uploadedFiles)
      .set({
        uploadedChunks: currentCount,
        updatedAt: new Date(),
      })
      .where(eq(uploadedFiles.id, fileId));

    return NextResponse.json(
      {
        success: true,
        chunkIndex,
        uploadedChunks: currentCount,
        totalChunks: fileRecord.totalChunks,
      },
      { status: 200, headers: noStore },
    );
  } catch (err) {
    return NextResponse.json({ error: "CHUNK_PROCESSING_FAILED", details: String(err) }, { status: 500, headers: noStore });
  }
}
