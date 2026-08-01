import type { Locale } from "@/types";

/**
 * Only permits in-app locale-scoped redirects. This keeps OAuth/auth callbacks
 * useful without allowing an attacker to turn a `next` parameter into an open redirect.
 */
export function safeAppRedirect(value: string | null | undefined, locale: Locale, fallback = `/${locale}/dashboard`) {
  if (!value) return fallback;
  if (!value.startsWith(`/${locale}/`) || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://anei.invalid");
    return parsed.origin === "https://anei.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}
