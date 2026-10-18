export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "dispostable.com",
  "throwawaymail.com",
  "getairmail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "trashmail.com",
  "burnermail.io",
  "10minutemail.net",
  "yopmail.fr",
  "yopmail.net",
  "mohmal.com",
  "nada.ltd",
  "crazymailing.com",
  "inboxkitten.com",
]);

export const VALID_TUNISIAN_PHONE_PREFIXES = ["2", "4", "5", "7", "9"] as const;

export const DUMMY_PHONE_SEQUENCES = new Set([
  "00000000",
  "11111111",
  "22222222",
  "33333333",
  "44444444",
  "55555555",
  "66666666",
  "77777777",
  "88888888",
  "99999999",
  "12345678",
  "23456789",
  "01234567",
  "87654321",
  "98765432",
  "76543210",
  "12121212",
  "21212121",
  "11223344",
]);

export type EmailErrorCode = "INVALID_FORMAT" | "DISPOSABLE_DOMAIN" | "EMAIL_TAKEN";
export type PhoneErrorCode = "INVALID_LENGTH" | "INVALID_PREFIX" | "DUMMY_SEQUENCE" | "PHONE_TAKEN";

export type EmailValidationResult =
  | { success: true; canonicalEmail: string; localPart: string; domain: string }
  | { success: false; canonicalEmail: string; error: "INVALID_FORMAT" | "DISPOSABLE_DOMAIN" };

export type PhoneValidationResult =
  | { success: true; canonicalPhone: string; nationalDigits: string }
  | { success: false; canonicalPhone: string; error: "INVALID_LENGTH" | "INVALID_PREFIX" | "DUMMY_SEQUENCE" };

/**
 * Validates and produces a canonical normalized email.
 * - Trims and lowercases.
 * - Handles Gmail/Googlemail alias protection: removes all '.' in local-part and strips '+...' extensions.
 * - Normalizes googlemail.com -> gmail.com.
 * - Detects and blocks known disposable email services.
 */
export function validateAndNormalizeCanonicalEmail(raw: string): EmailValidationResult {
  const trimmed = (raw || "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return { success: false, canonicalEmail: trimmed, error: "INVALID_FORMAT" };
  }

  // Basic RFC 5322-compliant syntax check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { success: false, canonicalEmail: trimmed, error: "INVALID_FORMAT" };
  }

  const atIndex = trimmed.lastIndexOf("@");
  let localPart = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1);

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { success: false, canonicalEmail: trimmed, error: "DISPOSABLE_DOMAIN" };
  }

  // Gmail & Googlemail canonical deduplication
  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Strip plus tag first
    localPart = localPart.split("+")[0];
    // Strip all dots
    localPart = localPart.replace(/\./g, "");
    domain = "gmail.com";
  }

  if (!localPart) {
    return { success: false, canonicalEmail: trimmed, error: "INVALID_FORMAT" };
  }

  const canonicalEmail = `${localPart}@${domain}`;
  return { success: true, canonicalEmail, localPart, domain };
}

/**
 * Returns canonical normalized email or throws/falls back to trimmed lowercase.
 */
export function normalizeCanonicalEmail(raw: string): string {
  const res = validateAndNormalizeCanonicalEmail(raw);
  return res.canonicalEmail;
}

/**
 * Validates and produces a canonical Tunisian phone (+216XXXXXXXX).
 * Accepts bare 8 digits, +216XXXXXXXX, 00216XXXXXXXX, 216XXXXXXXX, with spaces/dashes.
 */
export function validateAndNormalizeTunisianPhone(raw: string): PhoneValidationResult {
  let cleaned = (raw || "").trim().replace(/[\s.-]/g, "");

  if (cleaned.startsWith("+216")) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith("00216")) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith("216") && cleaned.length > 8) {
    cleaned = cleaned.slice(3);
  }

  // Extract only digits
  const nationalDigits = cleaned.replace(/\D/g, "");

  if (nationalDigits.length !== 8) {
    return { success: false, canonicalPhone: cleaned, error: "INVALID_LENGTH" };
  }

  const firstDigit = nationalDigits[0];
  if (!VALID_TUNISIAN_PHONE_PREFIXES.includes(firstDigit as (typeof VALID_TUNISIAN_PHONE_PREFIXES)[number])) {
    return { success: false, canonicalPhone: `+216${nationalDigits}`, error: "INVALID_PREFIX" };
  }

  // Reject all identical digits (e.g. 00000000, 11111111, 22222222, 99999999)
  if (/^(\d)\1{7}$/.test(nationalDigits)) {
    return { success: false, canonicalPhone: `+216${nationalDigits}`, error: "DUMMY_SEQUENCE" };
  }

  if (DUMMY_PHONE_SEQUENCES.has(nationalDigits)) {
    return { success: false, canonicalPhone: `+216${nationalDigits}`, error: "DUMMY_SEQUENCE" };
  }

  return { success: true, canonicalPhone: `+216${nationalDigits}`, nationalDigits };
}

export function normalizeTunisianPhoneStrict(raw: string): string | null {
  const res = validateAndNormalizeTunisianPhone(raw);
  return res.success ? res.canonicalPhone : null;
}

/**
 * Password Policy Enforcement.
 * Criteria:
 * - Minimum 10 chars (15 recommended)
 * - Contains uppercase, lowercase, digit, special character
 * - Does not contain user's name, email local-part, or phone
 */
export function validatePasswordPolicy(
  password: string,
  context?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  },
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const pwd = password || "";

  if (pwd.length < 10) {
    errors.push("PASSWORD_TOO_SHORT");
  }
  if (!/[A-Z]/.test(pwd)) {
    errors.push("PASSWORD_NO_UPPERCASE");
  }
  if (!/[a-z]/.test(pwd)) {
    errors.push("PASSWORD_NO_LOWERCASE");
  }
  if (!/\d/.test(pwd)) {
    errors.push("PASSWORD_NO_DIGIT");
  }
  if (!/[^a-zA-Z0-9\s]/.test(pwd)) {
    errors.push("PASSWORD_NO_SPECIAL");
  }

  if (context) {
    const lowerPwd = pwd.toLowerCase();
    const checks = [
      context.firstName?.trim().toLowerCase(),
      context.lastName?.trim().toLowerCase(),
      context.email ? context.email.split("@")[0]?.toLowerCase() : undefined,
      context.phone?.replace(/\D/g, "").slice(-8),
    ].filter((val): val is string => Boolean(val && val.length >= 3));

    for (const token of checks) {
      if (lowerPwd.includes(token)) {
        errors.push("PASSWORD_CONTAINS_PERSONAL_INFO");
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
