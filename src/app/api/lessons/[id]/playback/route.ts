import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { getLessonForPlayback } from "@/server/queries/account";
import { getStreamPlayback, MediaConfigurationError, MediaProviderError } from "@/server/media/cloudflare-stream";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { logger } from "@/server/security/logger";

const idSchema = z.string().uuid();
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Issues a short-lived Cloudflare Stream playback authorization for one
 * private lesson. userId always comes from the authenticated session, never
 * the request; lessonId is the only client-supplied identifier, and
 * course/organization membership is resolved server-side from it
 * (getLessonForPlayback), so no courseId/organizationId substitution can
 * bypass entitlement. YouTube lessons never call this route: they are
 * openly viewable preview lessons and embed directly from the mediaRef
 * already present on the lesson row returned to the client.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: noStore });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400, headers: noStore });

  const rate = await consumeRateLimit(`lesson-playback:${session.user.id}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const record = await getLessonForPlayback(session.user.id, id.data);
  if (!record || !record.entitled) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  if (record.lesson.mediaProvider !== "cloudflare_stream" || !record.lesson.mediaRef) {
    return NextResponse.json({ error: "NOT_APPLICABLE" }, { status: 400, headers: noStore });
  }

  try {
    const playback = await getStreamPlayback(record.lesson.mediaRef);
    return NextResponse.json(playback, { headers: noStore });
  } catch (error) {
    if (error instanceof MediaConfigurationError) {
      return NextResponse.json({ error: "PROVIDER_NOT_CONFIGURED" }, { status: 503, headers: noStore });
    }
    if (error instanceof MediaProviderError) {
      logger.error("lesson_playback.provider_failure", { lessonId: id.data });
      return NextResponse.json({ error: "PLAYBACK_UNAVAILABLE" }, { status: 502, headers: noStore });
    }
    throw error;
  }
}
