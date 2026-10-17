import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { getLessonForPlayback } from "@/server/queries/account";
import { generateSignedPlaybackToken } from "@/server/media/cloudflare-stream";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const session = await getSession();
  const { lessonId } = await params;

  if (!z.string().uuid().safeParse(lessonId).success) {
    return NextResponse.json({ error: "INVALID_LESSON_ID" }, { status: 400, headers: noStore });
  }

  const userId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  if (userId) {
    const rate = await consumeRateLimit(`lesson-playback:${userId}`, 60, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED" },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }

  const record = await getLessonForPlayback(userId, lessonId);
  if (!record) {
    return NextResponse.json({ error: "LESSON_NOT_FOUND" }, { status: 404, headers: noStore });
  }

  // Entitlement: preview lesson OR active enrollment OR admin role
  const isEntitled = record.entitled || isAdmin;
  if (!isEntitled) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Enrolment required to access this lesson." },
      { status: 403, headers: noStore },
    );
  }

  const lesson = record.lesson;

  // Cloudflare Stream video
  if (lesson.mediaProvider === "cloudflare_stream" && lesson.mediaRef) {
    try {
      const tokenResult = await generateSignedPlaybackToken(lesson.mediaRef, userId || "preview-user");
      return NextResponse.json(
        {
          provider: "cloudflare_stream",
          mediaRef: lesson.mediaRef,
          iframeUrl: tokenResult.iframeUrl,
          hlsUrl: tokenResult.hlsUrl,
          token: tokenResult.token,
          durationSeconds: lesson.durationSeconds,
          expiresAt: tokenResult.expiresAt,
        },
        { headers: noStore },
      );
    } catch (err) {
      logger.error("learning_video_playback.token_generation_failed", {
        lessonId,
        mediaRef: lesson.mediaRef,
        error: String(err),
      });
      return NextResponse.json({ error: "PLAYBACK_GENERATION_FAILED" }, { status: 502, headers: noStore });
    }
  }

  // Standard video url
  if (lesson.videoUrl) {
    return NextResponse.json(
      {
        provider: "internal",
        videoUrl: lesson.videoUrl,
        durationSeconds: lesson.durationSeconds,
      },
      { headers: noStore },
    );
  }

  // YouTube preview
  if (lesson.mediaProvider === "youtube" && lesson.mediaRef) {
    return NextResponse.json(
      {
        provider: "youtube",
        videoId: lesson.mediaRef,
        durationSeconds: lesson.durationSeconds,
      },
      { headers: noStore },
    );
  }

  return NextResponse.json({ error: "NO_VIDEO_ATTACHED" }, { status: 404, headers: noStore });
}

// Allow POST as well for consistency with trusted mutation check
export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403, headers: noStore });
  }
  return GET(request, context);
}
