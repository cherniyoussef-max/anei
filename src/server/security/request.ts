import "server-only";

export function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}
