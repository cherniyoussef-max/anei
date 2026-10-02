import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getPresignedCareDocumentDownload } from "@/server/services/care-notes-documents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });

  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rate = await consumeRateLimit(`care-doc-download:${session.user.id}`, 60, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const { id: documentId } = await params;
  const result = await getPresignedCareDocumentDownload(session.user.id, documentId);

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (result.kind === "forbidden") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    downloadUrl: result.downloadUrl,
    fileName: result.fileName,
  });
}
