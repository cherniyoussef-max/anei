import type { Locale } from "@/types";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";

export type SessionUserSummary = {
  role?: string | null;
  primaryPersona?: string | null;
  profileType?: string | null;
};

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

/**
 * Authoritative portal resolver across all personas and roles.
 * Eliminates double-redirects and client-side flickering post-login/post-OTP.
 */
export function resolveUserHomePath(
  locale: Locale | string,
  user: SessionUserSummary | null | undefined,
  explicitNext?: string | null,
  viewMode?: string | null,
): string {
  const loc: Locale = locale === "ar" ? "ar" : "fr";

  if (explicitNext) {
    const validated = safeAppRedirect(explicitNext, loc, "");
    if (validated && validated !== `/${loc}/dashboard`) {
      return validated;
    }
  }

  const role = String(user?.role ?? "");
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  if (isAdmin && viewMode !== "learner") {
    return `/${loc}/admin`;
  }

  const persona = user?.primaryPersona as Persona | undefined;
  if (persona && personaPortalPath[persona]) {
    return `/${loc}${personaPortalPath[persona]}`;
  }

  // Fallback support for legacy profileType field
  const profileType = user?.profileType;
  if (profileType === "parent") return `/${loc}/parent`;
  if (profileType === "teacher") return `/${loc}/teacher`;
  if (profileType === "avs") return `/${loc}/avs/espace`;
  if (profileType === "specialist") return `/${loc}/specialist`;
  if (profileType === "institution") return `/${loc}/organization`;

  return `/${loc}/dashboard`;
}
