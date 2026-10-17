export const courseVisuals = [
  "/media/domain-pedagogie.webp",
  "/media/domain-avs.webp",
  "/media/alaune-classroom.webp",
  "/media/anei-learning-story.webp",
  "/media/about-hero-team.webp",
  "/media/anei-hero-learning.webp",
  "/media/anei-learning-path.webp",
] as const;

const COURSE_SLUG_MAP: Record<string, string> = {
  "fondamentaux-education-inclusive": "/media/domain-pedagogie.webp",
  "avs-accompagnement-professionnel": "/media/domain-avs.webp",
  "tsa-classe-inclusive": "/media/alaune-classroom.webp",
  "differenciation-pedagogique": "/media/anei-learning-story.webp",
  "communication-alternative-aac": "/media/about-hero-team.webp",
  "parents-partenaires-inclusion": "/media/anei-hero-learning.webp",
};

export function getCourseVisual(slug: string) {
  if (COURSE_SLUG_MAP[slug]) {
    return COURSE_SLUG_MAP[slug];
  }
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) >>> 0;
  }
  return courseVisuals[hash % courseVisuals.length];
}
