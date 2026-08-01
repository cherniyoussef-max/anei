function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function normalizeTrustedOrigins(values: string[]) {
  return new Set(values.map(normalizeOrigin).filter((value): value is string => Boolean(value)));
}

/** Pure policy helper so origin behavior can be regression-tested outside Next.js. */
export function isTrustedMutationHeaders(headers: Headers, trustedOrigins: Set<string>) {
  const fetchSite = headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = headers.get("origin");
  if (origin) {
    const normalized = normalizeOrigin(origin);
    return Boolean(normalized && trustedOrigins.has(normalized));
  }

  const referer = headers.get("referer");
  if (referer) {
    const normalized = normalizeOrigin(referer);
    return Boolean(normalized && trustedOrigins.has(normalized));
  }

  // A sibling subdomain is `same-site` but is not automatically trusted.
  // Browser same-site requests therefore require Origin/Referer above.
  return !fetchSite || fetchSite === "none" || fetchSite === "same-origin";
}
