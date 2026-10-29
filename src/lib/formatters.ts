import type { Locale } from "@/types";

/**
 * Formats a Tunisian or international phone number into a readable, consistent string:
 * e.g. "+216 71 840 100" or "+216 73 360 220"
 */
export function formatTunisianPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "");

  // Format +216XXXXXXXX (8 digits after +216)
  if (cleaned.startsWith("+216") && cleaned.length === 12) {
    const area = cleaned.slice(4, 6);
    const mid = cleaned.slice(6, 9);
    const end = cleaned.slice(9, 12);
    return `+216 ${area} ${mid} ${end}`;
  }

  // Format 216XXXXXXXX (without leading +)
  if (cleaned.startsWith("216") && cleaned.length === 11) {
    const area = cleaned.slice(3, 5);
    const mid = cleaned.slice(5, 8);
    const end = cleaned.slice(8, 11);
    return `+216 ${area} ${mid} ${end}`;
  }

  // Format 8-digit local number (e.g. 71840100)
  if (cleaned.length === 8 && /^\d+$/.test(cleaned)) {
    const area = cleaned.slice(0, 2);
    const mid = cleaned.slice(2, 5);
    const end = cleaned.slice(5, 8);
    return `+216 ${area} ${mid} ${end}`;
  }

  return phone;
}

/**
 * Returns localized currency or "Gratuit" / "مجاني" if value is 0.
 */
export function formatAccessiblePrice(millimes: number, locale: Locale): string {
  if (!millimes || millimes === 0) {
    if (locale === "ar") return "مجاني";
    if (locale === "en") return "Free";
    return "Gratuit";
  }

  return new Intl.NumberFormat(locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(millimes / 1000);
}
