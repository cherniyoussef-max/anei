import "server-only";

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts a bare 11-char YouTube video id, or extracts one from an allowed
 * youtube.com/youtu.be URL form. Returns null for anything else (including
 * javascript:/data: schemes and unrelated origins) so a malicious value can
 * never become an iframe src.
 */
export function canonicalYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") ?? "";
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
    if (url.pathname.startsWith("/embed/")) {
      const id = url.pathname.slice("/embed/".length);
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
  }
  return null;
}

export function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
