import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { uploadedFiles, uploadedFileChunks } from "@/server/db/schema";

export async function GET(
  request: Request,
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

  const fileSize = Number(fileRecord.fileSizeBytes);
  const mimeType = fileRecord.mimeType || "video/mp4";
  const rangeHeader = request.headers.get("range");

  // If no Range header, return initial chunk or first part with Accept-Ranges
  if (!rangeHeader) {
    // Return first chunk if multi-chunk, or all if single chunk
    const chunks = await db
      .select({ chunkData: uploadedFileChunks.chunkData, chunkSizeBytes: uploadedFileChunks.chunkSizeBytes })
      .from(uploadedFileChunks)
      .where(eq(uploadedFileChunks.fileId, fileId))
      .orderBy(asc(uploadedFileChunks.chunkIndex));

    const totalBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c.chunkData, "base64")));

    return new NextResponse(totalBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(totalBuffer.length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  // Parse Range header: "bytes=start-end"
  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (isNaN(start) || start >= fileSize) {
    return new NextResponse("Requested range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  // Limit max range chunk response to ~4 MB for fast serverless responses
  const actualEnd = Math.min(end, start + 3 * 1024 * 1024 - 1, fileSize - 1);
  const contentLength = actualEnd - start + 1;

  // Each chunk is up to 2.5 MB (2621440 bytes).
  // Calculate which chunk indices are needed
  const CHUNK_SIZE = 2.5 * 1024 * 1024;
  const startChunkIdx = Math.floor(start / CHUNK_SIZE);
  const endChunkIdx = Math.floor(actualEnd / CHUNK_SIZE);

  // Fetch only the needed chunks from DB
  const chunks = await db
    .select({
      chunkIndex: uploadedFileChunks.chunkIndex,
      chunkData: uploadedFileChunks.chunkData,
      chunkSizeBytes: uploadedFileChunks.chunkSizeBytes,
    })
    .from(uploadedFileChunks)
    .where(eq(uploadedFileChunks.fileId, fileId))
    .orderBy(asc(uploadedFileChunks.chunkIndex));

  // Stitch required chunks
  const buffers: Buffer[] = [];
  for (const c of chunks) {
    if (c.chunkIndex >= startChunkIdx && c.chunkIndex <= endChunkIdx) {
      buffers.push(Buffer.from(c.chunkData, "base64"));
    }
  }

  const stitched = Buffer.concat(buffers);
  // Calculate offset within the stitched buffer
  const offsetInStitched = start - (startChunkIdx * CHUNK_SIZE);
  const sliced = stitched.subarray(offsetInStitched, offsetInStitched + contentLength);

  return new NextResponse(sliced, {
    status: 206,
    headers: {
      "Content-Range": `bytes ${start}-${actualEnd}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(sliced.length),
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
