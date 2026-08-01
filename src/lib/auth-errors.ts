import type { Locale } from "@/types";

const GOOGLE_ERROR_CODES = new Set([
  "access_denied",
  "account_not_linked",
  "email_does_not_match",
  "google_auth_failed",
  "invalid_state",
  "oauth_callback_error",
  "unable_to_create_session",
  "unable_to_link_account",
]);

export function googleAuthErrorMessage(locale: Locale, code?: string | null) {
  if (!code) return null;
  const normalized = code.toLowerCase().replaceAll(" ", "_");
  const ar = locale === "ar";

  if (normalized === "access_denied") {
    return ar ? "تم إلغاء تسجيل الدخول عبر Google." : "La connexion Google a été annulée.";
  }
  if (normalized.includes("account") || normalized.includes("email")) {
    return ar
      ? "تعذر ربط حساب Google بهذا الحساب بأمان. سجّل الدخول بالطريقة المعتادة ثم اربط Google من إعدادات الحساب."
      : "Ce compte Google ne peut pas être associé automatiquement en toute sécurité. Connectez-vous normalement, puis associez Google depuis les paramètres.";
  }
  if (GOOGLE_ERROR_CODES.has(normalized) || normalized.includes("oauth") || normalized.includes("state")) {
    return ar
      ? "تعذر إتمام تسجيل الدخول عبر Google. أعد المحاولة أو استخدم البريد الإلكتروني."
      : "La connexion Google n’a pas abouti. Réessayez ou utilisez votre adresse e-mail.";
  }
  return ar
    ? "تعذر إتمام تسجيل الدخول. أعد المحاولة."
    : "La connexion n’a pas abouti. Veuillez réessayer.";
}
