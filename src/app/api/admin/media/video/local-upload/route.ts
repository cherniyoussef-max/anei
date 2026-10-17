import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { videoAssets, lessons } from "@/server/db/schema";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

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

  const url = new URL(request.url);
  let assetId = url.searchParams.get("assetId");

  try {
    const formData = await request.formData();
    if (!assetId) {
      const fromForm = formData.get("assetId");
      if (typeof fromForm === "string") assetId = fromForm;
    }
  } catch {
    // If not multipart form, might be raw upload
  }

  if (!assetId) {
    return NextResponse.json({ error: "MISSING_ASSET_ID" }, { status: 400, headers: noStore });
  }

  const [asset] = await db.select().from(videoAssets).where(eq(videoAssets.id, assetId)).limit(1);
  if (!asset) {
    return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404, headers: noStore });
  }

  const mockDuration = asset.durationSeconds > 0 ? asset.durationSeconds : 720;
  const mockThumbnail = "/demo/video-poster.svg";
  const mockHls = "/demo/video.mp4";

  const [updatedAsset] = await db
    .update(videoAssets)
    .set({
      status: "READY",
      encodingProgressPercent: 100,
      durationSeconds: mockDuration,
      thumbnailUrl: mockThumbnail,
      playbackHlsUrl: mockHls,
      updatedAt: new Date(),
    })
    .where(eq(videoAssets.id, asset.id))
    .returning();

  if (updatedAsset.lessonId) {
    await db
      .update(lessons)
      .set({
        mediaProvider: "cloudflare_stream",
        mediaRef: updatedAsset.cloudflareUid,
        durationSeconds: mockDuration,
      })
      .where(eq(lessons.id, updatedAsset.lessonId));
  }

  logger.info("local_stream_engine.video_upload_completed", {
    assetId: updatedAsset.id,
    uid: updatedAsset.cloudflareUid,
    lessonId: updatedAsset.lessonId,
  });

  return NextResponse.json(
    {
      success: true,
      status: "READY",
      uid: updatedAsset.cloudflareUid,
      durationSeconds: mockDuration,
      thumbnailUrl: mockThumbnail,
    },
    { status: 200, headers: noStore },
  );
}
