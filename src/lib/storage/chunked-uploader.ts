/**
 * Universal Chunked Uploader
 * Bypasses Vercel 4.5 MB request limit by slicing files into 2.5 MB chunks
 * Supports arbitrarily large videos (500 MB+) and PDFs with real progress reporting.
 */

export interface ChunkedUploadProgress {
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  speedFormatted: string;
}

export interface ChunkedUploadResult {
  fileId: string;
  url: string;
  streamUrl: string;
  downloadUrl: string;
  filename: string;
  durationSeconds?: number;
}

const CHUNK_SIZE = 2.5 * 1024 * 1024; // 2.5 MB

export async function uploadFileInChunks(
  file: File,
  options: {
    category: "video" | "document" | "course" | "avatar" | "general";
    durationSeconds?: number;
    onProgress?: (progress: ChunkedUploadProgress) => void;
  },
): Promise<ChunkedUploadResult> {
  const totalBytes = file.size;
  const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
  const startTime = Date.now();

  // 1. Initialize session
  const initRes = await fetch("/api/storage/chunk-upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: totalBytes,
      totalChunks,
      category: options.category,
      durationSeconds: options.durationSeconds || 0,
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => "");
    throw new Error(`Init failed HTTP ${initRes.status}: ${errText}`);
  }

  const { fileId } = (await initRes.json()) as { fileId: string };
  let loadedBytes = 0;

  // 2. Upload chunks sequentially for maximum reliability
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunkBlob = file.slice(start, end);

    const formData = new FormData();
    formData.append("fileId", fileId);
    formData.append("chunkIndex", String(chunkIndex));
    formData.append("chunk", chunkBlob, `chunk-${chunkIndex}`);

    let chunkRes: Response | null = null;
    let attempts = 0;

    while (attempts < 3) {
      try {
        attempts++;
        chunkRes = await fetch("/api/storage/chunk-upload/chunk", {
          method: "POST",
          body: formData,
        });
        if (chunkRes.ok) break;
      } catch {
        if (attempts >= 3) throw new Error(`Chunk ${chunkIndex} upload failed after 3 attempts`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!chunkRes || !chunkRes.ok) {
      throw new Error(`Chunk ${chunkIndex} failed with HTTP ${chunkRes?.status}`);
    }

    loadedBytes = end;
    const percent = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speedBytes = elapsedSec > 0 ? loadedBytes / elapsedSec : 0;
    const speedMb = (speedBytes / (1024 * 1024)).toFixed(1);

    if (options.onProgress) {
      options.onProgress({
        percent,
        loadedBytes,
        totalBytes,
        speedFormatted: `${speedMb} Mo/s`,
      });
    }
  }

  // 3. Complete and finalize
  const completeRes = await fetch("/api/storage/chunk-upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId,
      durationSeconds: options.durationSeconds,
    }),
  });

  if (!completeRes.ok) {
    const err = await completeRes.text().catch(() => "");
    throw new Error(`Completion failed: ${err}`);
  }

  const data = (await completeRes.json()) as ChunkedUploadResult;

  if (options.onProgress) {
    options.onProgress({
      percent: 100,
      loadedBytes: totalBytes,
      totalBytes,
      speedFormatted: "Terminé",
    });
  }

  return data;
}
