import { NextResponse } from "next/server";
import { getFileMetadata, getFileSlice, getFullFileData } from "@/server/storage/app-storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key: keyParts } = await context.params;
  const objectKey = Array.isArray(keyParts) ? keyParts.join("/") : String(keyParts || "");

  if (!objectKey) {
    return NextResponse.json({ error: "INVALID_KEY" }, { status: 400 });
  }

  const meta = await getFileMetadata(objectKey);
  if (!meta) {
    return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  const totalSize = meta.fileSize;

  // Handle HTTP 206 Partial Content (Video / Audio streaming & scrubbing)
  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const rangeParts = rangeHeader.replace("bytes=", "").split("-");
    const start = parseInt(rangeParts[0], 10);
    let end = rangeParts[1] ? parseInt(rangeParts[1], 10) : totalSize - 1;

    if (isNaN(start) || start >= totalSize || start < 0) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalSize}`,
        },
      });
    }

    // Limit chunk size to 2 MB per streaming slice to maintain optimal latency
    const maxChunk = 2 * 1024 * 1024;
    if (end - start + 1 > maxChunk) {
      end = start + maxChunk - 1;
    }
    if (end >= totalSize) {
      end = totalSize - 1;
    }

    const chunkLength = end - start + 1;
    const sliceBuffer = await getFileSlice(objectKey, start, chunkLength);

    if (!sliceBuffer) {
      return NextResponse.json({ error: "READ_ERROR" }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(sliceBuffer), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(sliceBuffer.length),
        "Content-Type": meta.contentType || "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Full file request (PDF documents, images, downloadables)
  const fullData = await getFullFileData(objectKey);
  if (!fullData) {
    return NextResponse.json({ error: "READ_ERROR" }, { status: 500 });
  }

  const isPdf = meta.contentType === "application/pdf" || objectKey.endsWith(".pdf");
  const disposition = isPdf ? "inline" : "inline";

  return new NextResponse(new Uint8Array(fullData), {
    status: 200,
    headers: {
      "Content-Type": meta.contentType || "application/octet-stream",
      "Content-Length": String(totalSize),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(meta.filename)}"`,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key: keyParts } = await context.params;
  const objectKey = Array.isArray(keyParts) ? keyParts.join("/") : String(keyParts || "");

  const meta = await getFileMetadata(objectKey);
  if (!meta) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": meta.contentType || "application/octet-stream",
      "Content-Length": String(meta.fileSize),
      "Accept-Ranges": "bytes",
    },
  });
}
