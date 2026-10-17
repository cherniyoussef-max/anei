import { NextResponse } from "next/server";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { createStreamDirectUpload, MediaConfigurationError, MediaProviderError } from "@/server/media/cloudflare-stream";
import { cloudflareStreamConfigured } from "@/server/env";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Creates a pre-signed Direct Creator Upload URL from Cloudflare Stream.
 * Allows the admin browser to upload large course video files directly to Cloudflare's
 * global edge network without hitting Vercel's 4.5MB serverless payload limit
 * or incurring Vercel bandwidth costs.
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

  // If Cloudflare Stream credentials are not configured:
  // In development/test environments, return a mock endpoint so non-production workflows can be tested safely.
  if (!cloudflareStreamConfigured) {
    if (process.env.NODE_ENV !== "production") {
      const mockUid = "0123456789abcdef0123456789abcdef";
      return NextResponse.json(
        {
          uploadUrl: "/api/admin/media/mock-stream-upload",
          uid: mockUid,
          mock: true,
        },
        { status: 201, headers: noStore },
      );
    }
    return NextResponse.json(
      { error: "CLOUDFLARE_STREAM_NOT_CONFIGURED" },
      { status: 503, headers: noStore },
    );
  }

  try {
    const directUpload = await createStreamDirectUpload({ maxDurationSeconds: 14400 });
    return NextResponse.json(
      {
        uploadUrl: directUpload.uploadUrl,
        uid: directUpload.uid,
      },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    if (error instanceof MediaConfigurationError) {
      return NextResponse.json({ error: "CLOUDFLARE_STREAM_NOT_CONFIGURED" }, { status: 503, headers: noStore });
    }
    if (error instanceof MediaProviderError) {
      logger.error("stream_direct_upload.provider_failure", { adminUserId: session.user.id });
      return NextResponse.json({ error: "STREAM_UPLOAD_FAILED" }, { status: 502, headers: noStore });
    }
    logger.error("stream_direct_upload.unexpected_error", { error: String(error) });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500, headers: noStore });
  }
}
