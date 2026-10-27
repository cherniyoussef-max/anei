import { NextResponse } from "next/server";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { createDirectUploadSession } from "@/server/media/cloudflare-stream";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Creates a pre-signed Direct Creator Upload URL from Cloudflare Stream
 * or transparent local fallback engine.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403, headers: noStore });
  }

  const session = await getAdminSessionFor("courses.update");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = ((await readLimitedJson(request)) as Record<string, unknown>) || {};
  } catch {
    // optional body
  }

  try {
    const uploadSession = await createDirectUploadSession({
      filename: typeof body.filename === "string" ? body.filename : undefined,
      fileSizeBytes: typeof body.fileSizeBytes === "number" ? body.fileSizeBytes : undefined,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      lessonId: typeof body.lessonId === "string" ? body.lessonId : null,
      courseId: typeof body.courseId === "string" ? body.courseId : null,
      adminId: session.user.id,
    });

    return NextResponse.json(
      {
        assetId: uploadSession.assetId,
        uploadUrl: uploadSession.uploadUrl,
        uid: uploadSession.cloudflareUid,
        provider: uploadSession.provider,
        mock: uploadSession.provider === "LOCAL_DEV",
      },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    logger.error("stream_direct_upload.unexpected_error", { error: String(error) });
    return NextResponse.json({ error: "STREAM_UPLOAD_FAILED" }, { status: 500, headers: noStore });
  }
}
