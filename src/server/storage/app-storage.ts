import "server-only";
import crypto from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, pool } from "@/server/db";
import { appStorageFiles, appStorageChunks, type AppStorageFileRow } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

/**
 * Saves a complete file directly to PostgreSQL storage.
 */
export async function saveUploadedFile(input: {
  objectKey: string;
  category: string;
  filename: string;
  contentType: string;
  data: Buffer;
}): Promise<AppStorageFileRow> {
  const fileId = crypto.randomUUID();
  const [file] = await db
    .insert(appStorageFiles)
    .values({
      id: fileId,
      objectKey: input.objectKey,
      category: input.category,
      filename: input.filename,
      contentType: input.contentType || "application/octet-stream",
      fileSize: input.data.length,
      data: input.data,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appStorageFiles.objectKey,
      set: {
        filename: input.filename,
        contentType: input.contentType || "application/octet-stream",
        fileSize: input.data.length,
        data: input.data,
        updatedAt: new Date(),
      },
    })
    .returning();

  return file;
}

/**
 * Saves one chunk of a multi-part chunked upload.
 */
export async function saveChunk(input: {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Buffer;
}): Promise<void> {
  await db
    .insert(appStorageChunks)
    .values({
      id: crypto.randomUUID(),
      uploadId: input.uploadId,
      chunkIndex: input.chunkIndex,
      totalChunks: input.totalChunks,
      data: input.data,
    });
}

/**
 * Merges all chunks for an uploadId and stores the assembled file.
 * Automatically cleans up the chunk records.
 */
export async function finalizeChunkedUpload(input: {
  uploadId: string;
  objectKey: string;
  category: string;
  filename: string;
  contentType: string;
}): Promise<AppStorageFileRow> {
  // Query all chunks in order
  const chunks = await db
    .select({ data: appStorageChunks.data })
    .from(appStorageChunks)
    .where(eq(appStorageChunks.uploadId, input.uploadId))
    .orderBy(asc(appStorageChunks.chunkIndex));

  if (!chunks.length) {
    throw new Error("NO_CHUNKS_FOUND");
  }

  // Concatenate buffer chunks
  const fullBuffer = Buffer.concat(chunks.map((c) => c.data));

  // Save assembled file
  const file = await saveUploadedFile({
    objectKey: input.objectKey,
    category: input.category,
    filename: input.filename,
    contentType: input.contentType,
    data: fullBuffer,
  });

  // Clean up temporary chunks asynchronously
  try {
    await db.delete(appStorageChunks).where(eq(appStorageChunks.uploadId, input.uploadId));
  } catch (err) {
    logger.warn("app_storage.chunks_cleanup_failed", { uploadId: input.uploadId, error: String(err) });
  }

  return file;
}

/**
 * Fetches file metadata without loading the binary data into memory.
 */
export async function getFileMetadata(objectKey: string): Promise<{
  id: string;
  objectKey: string;
  filename: string;
  contentType: string;
  fileSize: number;
} | null> {
  const [row] = await db
    .select({
      id: appStorageFiles.id,
      objectKey: appStorageFiles.objectKey,
      filename: appStorageFiles.filename,
      contentType: appStorageFiles.contentType,
      fileSize: appStorageFiles.fileSize,
    })
    .from(appStorageFiles)
    .where(eq(appStorageFiles.objectKey, objectKey))
    .limit(1);

  return row || null;
}

/**
 * Reads a precise byte slice using PostgreSQL substring() to stream partial content
 * efficiently without loading the entire large file into memory.
 */
export async function getFileSlice(
  objectKey: string,
  start: number,
  length: number,
): Promise<Buffer | null> {
  // PostgreSQL substring(bytea from 1-based-offset for length)
  const pgOffset = Math.max(1, Math.floor(start) + 1);
  const pgLen = Math.max(1, Math.floor(length));

  const result = await pool.query<{ slice: Buffer }>(
    `SELECT substring("data" FROM $1 FOR $2) AS slice FROM "app_storage_files" WHERE "object_key" = $3 LIMIT 1`,
    [pgOffset, pgLen, objectKey],
  );

  if (!result.rows.length || !result.rows[0].slice) {
    return null;
  }

  return result.rows[0].slice;
}

/**
 * Reads full binary file data.
 */
export async function getFullFileData(objectKey: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ data: appStorageFiles.data })
    .from(appStorageFiles)
    .where(eq(appStorageFiles.objectKey, objectKey))
    .limit(1);

  return row?.data || null;
}
