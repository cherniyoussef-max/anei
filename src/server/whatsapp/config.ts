import { env } from "@/server/env";

/**
 * Deployment-level Meta credential configuration. WhatsApp uses a SINGLE
 * deployment-level Meta business credential (env-only, never persisted in the
 * database); `whatsapp_account` rows carry only non-secret provider metadata
 * (phone number id, waba id) that maps a Meta number to an organization.
 *
 * configured → enabled. Not configured → the feature reports unavailable/
 * disabled safely instead of crashing unrelated LMS functionality.
 */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    env.ENABLE_WHATSAPP &&
      env.WHATSAPP_ACCESS_TOKEN &&
      env.WHATSAPP_APP_SECRET &&
      env.WHATSAPP_VERIFY_TOKEN,
  );
}

export const whatsappConfigured = isWhatsAppConfigured();

export const whatsappApiBaseUrl = env.WHATSAPP_API_BASE_URL;
export const whatsappApiVersion = env.WHATSAPP_API_VERSION;

/** Never log these. Only the provider reads them from env directly. */
export const whatsappAccessToken = env.WHATSAPP_ACCESS_TOKEN;
export const whatsappAppSecret = env.WHATSAPP_APP_SECRET;
export const whatsappVerifyToken = env.WHATSAPP_VERIFY_TOKEN;