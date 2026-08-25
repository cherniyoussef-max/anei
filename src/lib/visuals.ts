export const courseVisuals = [
  "/media/anei-hero-learning.webp",
  "/media/anei-learning-story.webp",
  "/media/anei-learning-path.webp",
] as const;

export function getCourseVisual(slug: string) {
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) >>> 0;
  }
  return courseVisuals[hash % courseVisuals.length];
}
