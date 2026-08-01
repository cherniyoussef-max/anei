/** Raised before an oversized request body is fully buffered. */
export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("REQUEST_BODY_TOO_LARGE");
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Read a JSON body with a hard byte ceiling even when Content-Length is absent.
 * This prevents custom Route Handlers from buffering arbitrarily large payloads.
 */
export async function readLimitedJson(request: Request, maxBytes = 128 * 1024): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyTooLargeError();
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("body too large").catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return text ? JSON.parse(text) : null;
}
