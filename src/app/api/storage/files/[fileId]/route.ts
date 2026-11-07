import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { uploadedFiles, uploadedFileChunks } from "@/server/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  if (!fileId) {
    return new NextResponse("File ID required", { status: 400 });
  }

  const [fileRecord] = await db
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);

  if (!fileRecord || !fileRecord.isComplete) {
    return new NextResponse("File not found or upload in progress", { status: 404 });
  }

  const chunks = await db
    .select({
      chunkData: uploadedFileChunks.chunkData,
      chunkSizeBytes: uploadedFileChunks.chunkSizeBytes,
    })
    .from(uploadedFileChunks)
    .where(eq(uploadedFileChunks.fileId, fileId))
    .orderBy(asc(uploadedFileChunks.chunkIndex));

  const totalBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c.chunkData, "base64")));
  const mimeType = fileRecord.mimeType || "application/pdf";
  const safeFilename = encodeURIComponent(fileRecord.filename.replace(/["\r\n]/g, "_"));

  return new NextResponse(totalBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(totalBuffer.length),
      "Content-Disposition": `inline; filename="${safeFilename}"`,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
