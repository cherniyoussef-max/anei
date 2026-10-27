import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { createDirectUploadSession } from "@/server/media/cloudflare-stream";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

const uploadPayloadSchema = z.object({
  filename: z.string().max(255).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(100).optional(),
  lessonId: z.string().uuid().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
});

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

  let body = {};
  try {
    body = (await readLimitedJson(request)) || {};
  } catch {
    // optional payload
  }

  const parsed = uploadPayloadSchema.safeParse(body);
  const data = parsed.success ? parsed.data : {};

  try {
    const sessionResult = await createDirectUploadSession({
      filename: data.filename,
      fileSizeBytes: data.fileSizeBytes,
      mimeType: data.mimeType,
      lessonId: data.lessonId,
      courseId: data.courseId,
      adminId: session.user.id,
    });

    return NextResponse.json(
      {
        assetId: sessionResult.assetId,
        uploadUrl: sessionResult.uploadUrl,
        uid: sessionResult.cloudflareUid,
        provider: sessionResult.provider,
        requireSignedUrls: sessionResult.requireSignedUrls,
      },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    logger.error("stream_video_upload_url.failed", {
      adminId: session.user.id,
      error: String(error),
    });
    return NextResponse.json({ error: "UPLOAD_SESSION_FAILED" }, { status: 500, headers: noStore });
  }
}
