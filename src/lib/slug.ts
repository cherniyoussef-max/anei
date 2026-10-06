/**
 * Sanitizes and formats a text string into a URL-friendly kebab-case slug.
 * Handles French accents, spaces, special symbols, and truncation safely.
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics / accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric except spaces & hyphens
    .trim()
    .replace(/\s+/g, "-") // replace whitespace runs with hyphens
    .replace(/-+/g, "-") // collapse repeated hyphens
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .slice(0, 100);
}
