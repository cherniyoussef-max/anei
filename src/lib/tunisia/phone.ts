/**
 * Canonical Tunisia phone helper. ANEI onboarding only supports Tunisian
 * numbers (see src/server/auth/profile.ts), so this is the single place
 * that normalizes/validates the local 8-digit national number against the
 * fixed +216 country prefix. Reused by both the onboarding wizard (client
 * preview) and server-side validation - the client is never authoritative.
 *
 * Canonical persisted format: "+216XXXXXXXX" (no spaces).
 */

const TUNISIA_PREFIX = "+216";
const NATIONAL_DIGITS = 8;

/** Strips everything but digits - used to read back a raw local-number input value. */
export function extractNationalDigits(value: string): string {
  let stripped = value.trim();
  if (stripped.startsWith(TUNISIA_PREFIX)) stripped = stripped.slice(TUNISIA_PREFIX.length);
  else if (stripped.startsWith("216")) stripped = stripped.slice(3);
  else if (stripped.startsWith("+")) stripped = stripped.slice(1);
  return stripped.replace(/\D/g, "").slice(0, NATIONAL_DIGITS);
}

/** Formats raw national digits for display, e.g. "20311900" -> "20 311 900". */
export function formatNationalDigits(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, NATIONAL_DIGITS);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8)].filter(Boolean).join(" ");
}

/**
 * Normalizes a Tunisian phone number to "+216XXXXXXXX". Accepts a bare
 * 8-digit local number, a "216XXXXXXXX" or "+216XXXXXXXX" full number, with
 * or without spaces. Returns null for anything that isn't exactly one
 * Tunisian country prefix followed by 8 digits (rejects malformed/duplicate
 * prefixes such as "+216+21620311900", too-short/too-long numbers, and
 * non-digit input).
 */
export function normalizeTunisiaPhone(value: string): string | null {
  const trimmed = value.trim().replace(/[\s.-]/g, "");
  if (!trimmed) return null;

  // Reject anything containing a '+' that isn't exactly a single leading +216.
  const plusCount = (trimmed.match(/\+/g) ?? []).length;
  if (plusCount > 1) return null;
  if (trimmed.includes("+") && !trimmed.startsWith("+216")) return null;

  let digits: string;
  if (trimmed.startsWith("+216")) {
    digits = trimmed.slice(4);
  } else if (trimmed.startsWith("216") && trimmed.length > NATIONAL_DIGITS) {
    digits = trimmed.slice(3);
  } else {
    digits = trimmed;
  }

  if (!/^\d{8}$/.test(digits)) return null;
  return `${TUNISIA_PREFIX}${digits}`;
}

export function isValidTunisiaPhone(value: string): boolean {
  return normalizeTunisiaPhone(value) !== null;
}
