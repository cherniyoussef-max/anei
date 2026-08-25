import type { Locale } from "@/types";
import { YoutubePlayer } from "@/components/learning/YoutubePlayer";

/** Public/preview lessons only. videoId is already validated/canonicalized server-side (canonicalYoutubeId) before it reaches this component. */
export function YoutubeLessonPlayer({ videoId, title, locale }: { videoId: string; title: string; locale: Locale }) {
  const ar = locale === "ar";
  const en = locale === "en";
  return <div className="lesson-player">
    <YoutubePlayer videoId={videoId} title={title} />
    <div className="lesson-player-meta">
      <div><strong>{title}</strong><small>{ar ? "معاينة يوتيوب" : en ? "YouTube preview" : "Aperçu YouTube"}</small></div>
    </div>
  </div>;
}
