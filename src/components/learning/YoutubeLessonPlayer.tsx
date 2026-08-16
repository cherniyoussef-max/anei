import type { Locale } from "@/types";

/** Public/preview lessons only. videoId is already validated/canonicalized server-side (canonicalYoutubeId) before it reaches this component. */
export function YoutubeLessonPlayer({ videoId, title, locale }: { videoId: string; title: string; locale: Locale }) {
  const ar = locale === "ar";
  return <div className="lesson-player">
    <iframe
      className="course-video"
      src={`https://www.youtube-nocookie.com/embed/${videoId}`}
      title={title}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
    <div className="lesson-player-meta">
      <div><strong>{title}</strong><small>{ar ? "معاينة يوتيوب" : "Aperçu YouTube"}</small></div>
    </div>
  </div>;
}
