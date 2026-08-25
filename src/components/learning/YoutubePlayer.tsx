/** Generic public YouTube embed (no lesson-specific chrome). videoId must already be canonicalized/validated server-side (see @/server/media/youtube). */
export function YoutubePlayer({ videoId, title, className }: { videoId: string; title: string; className?: string }) {
  return <iframe
    className={className ?? "course-video"}
    src={`https://www.youtube-nocookie.com/embed/${videoId}`}
    title={title}
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
    referrerPolicy="strict-origin-when-cross-origin"
  />;
}
