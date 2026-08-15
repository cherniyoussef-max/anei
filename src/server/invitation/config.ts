// Phase 6 invitation/verification policy constants. Single source of truth for
// every lifecycle bound; tuned so a legitimate user is never obstructed while
// an attacker's window stays narrow (short OTP TTL, small attempt budget,
// cooldowns, per-invitation send caps). See docs/premium/ROADMAP.md Phase 6.

/** Total lifetime of an invitation token (SHA-256 digest stored; raw never). */
export const INVITATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A verification code is valid for 10 minutes after it is generated. */
export const INVITATION_OTP_TTL_MS = 10 * 60 * 1000;

/** Hard cap on wrong OTP attempts per challenge before it is locked. */
export const INVITATION_OTP_MAX_ATTEMPTS = 5;

/** Minimum delay between two invitation (re)sends to the same invitation. */
export const INVITATION_RESEND_COOLDOWN_MS = 60 * 1000;

/** Minimum delay between two OTP sends for the same invitation. */
export const INVITATION_OTP_COOLDOWN_MS = 60 * 1000;

/** Maximum invitation sends (initial + resends) for one invitation. */
export const INVITATION_MAX_SENDS = 5;

/** Maximum OTP sends for one invitation (covers cooldown-bounded resends). */
export const INVITATION_MAX_OTP_SENDS = 5;

/**
 * WhatsApp template names the invitation flow sends programmatically. The
 * organization must sync APPROVED templates with exactly these names (plus a
 * body parameter for the invitation link / the OTP code). Resolution is
 * always server-side against the org's own template catalog — never
 * client-supplied.
 */
export const INVITATION_WHATSAPP_TEMPLATE_NAME = "anei_account_invitation";
export const INVITATION_OTP_TEMPLATE_NAME = "anei_otp_verification";