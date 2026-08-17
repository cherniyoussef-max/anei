import "server-only";

const MAX_JSON_BYTES = 1024 * 1024;

export function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export async function readLimitedJson<T>(request: Request, maxBytes = MAX_JSON_BYTES): Promise<T | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error("Request body too large");
  }

  const reader = request.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) throw new Error("Request body too large");
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) return null;

  try {
    return JSON.parse(buffer.toString("utf8")) as T;
  } catch {
    throw new Error("Invalid JSON");
  }
}
