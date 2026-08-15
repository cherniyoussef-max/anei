// WhatsApp phone number normalization. Meta's Cloud API identifies recipients
// and inbound senders by `wa_id` — digits only, no `+`, no spaces (e.g.
// `21620123456`). We store the same canonical form so outbound `to`, inbound
// `from` and CRM contact phone matching all compare like-for-like.

const PHONE_RE = /^[+]?[0-9]{6,15}$/;

/**
 * Canonicalizes an arbitrary phone input into the digits-only wa_id form.
 * Returns null when the input is unusable (missing, empty, non-numeric, or
 * implausible length). Never throws — a null result maps to a controlled
 * "no usable phone" domain result.
 */
export function normalizeWhatsAppPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^0-9]/g, "");
  if (!PHONE_RE.test(digits)) return null;
  // A plausible international number needs at least a country code (>= 8 digits
  // after stripping a leading 0) — guard against obviously local-only values.
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

/**
 * Compares a stored contact phone (any format) to an inbound wa_id
 * (digits-only). Returns true when they normalize to the same number.
 */
export function phonesMatch(contactPhone: string | null | undefined, waId: string | null | undefined): boolean {
  const a = normalizeWhatsAppPhone(contactPhone);
  const b = normalizeWhatsAppPhone(waId);
  if (!a || !b) return false;
  return a === b;
}

/** Human-readable E.164-ish display form (leading `+`) for the admin UI. */
export function displayPhone(waId: string | null | undefined): string | null {
  const normalized = normalizeWhatsAppPhone(waId);
  return normalized ? `+${normalized}` : null;
}