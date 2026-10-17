import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor } from "@/server/auth/admin";
import { syncVideoAssetStatus, MediaProviderError } from "@/server/media/cloudflare-stream";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const session = await getAdminSessionFor("courses.update");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  }

  const { assetId } = await params;
  if (!z.string().uuid().safeParse(assetId).success) {
    return NextResponse.json({ error: "INVALID_ASSET_ID" }, { status: 400, headers: noStore });
  }

  try {
    const result = await syncVideoAssetStatus({ assetId });
    return NextResponse.json(
      {
        success: true,
        assetId: result.asset.id,
        status: result.asset.status,
        isReady: result.isReady,
        progressPercent: result.progressPercent,
        durationSeconds: result.durationSeconds,
        thumbnailUrl: result.thumbnailUrl,
        playbackHlsUrl: result.playbackHlsUrl,
        cloudflareUid: result.asset.cloudflareUid,
        lessonId: result.asset.lessonId,
      },
      { headers: noStore },
    );
  } catch (err) {
    if (err instanceof MediaProviderError && err.message === "ASSET_NOT_FOUND") {
      return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404, headers: noStore });
    }
    logger.error("video_asset_status.polling_failed", { assetId, error: String(err) });
    return NextResponse.json({ error: "STATUS_CHECK_FAILED" }, { status: 500, headers: noStore });
  }
}
