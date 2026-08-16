import { z } from "zod";
import { canonicalYoutubeId } from "@/server/media/youtube";
import { isValidStreamUid } from "@/server/media/cloudflare-stream";

export const mediaProviderSchema = z.enum(["internal", "youtube", "cloudflare_stream"]);
export type MediaProvider = z.infer<typeof mediaProviderSchema>;

export class InvalidLessonMediaError extends Error {}

/**
 * Normalizes and validates a lesson's mediaRef against its provider, and
 * enforces the cross-field rule (YouTube is public/preview-only) that a
 * single-field zod schema can't express once lesson create (all fields
 * present) and lesson update (partial, merged with the existing row) share
 * the same rule. Returns the value to persist (never raw admin-provided
 * iframe/HTML, only a validated provider-native identifier).
 */
export function resolveMediaRef(provider: MediaProvider, mediaRef: string | null | undefined, preview: boolean): string | null {
  if (provider === "internal") return null;
  const raw = mediaRef?.trim();
  if (!raw) throw new InvalidLessonMediaError("MEDIA_REF_REQUIRED");

  if (provider === "youtube") {
    if (!preview) throw new InvalidLessonMediaError("YOUTUBE_REQUIRES_PREVIEW");
    const id = canonicalYoutubeId(raw);
    if (!id) throw new InvalidLessonMediaError("INVALID_YOUTUBE_REFERENCE");
    return id;
  }

  if (!isValidStreamUid(raw)) throw new InvalidLessonMediaError("INVALID_STREAM_REFERENCE");
  return raw;
}
