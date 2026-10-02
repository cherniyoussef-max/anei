import { env } from "@/server/env";

export const metaGraphApiBaseUrl = process.env.META_GRAPH_API_BASE_URL?.trim() || "https://graph.facebook.com";
export const metaGraphApiVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v22.0";

const isProduction = process.env.NODE_ENV === "production";

/**
 * App secret used for X-Hub-Signature-256 calculation.
 * Shared across WhatsApp, Messenger and Instagram under the same Meta App.
 */
export const metaAppSecret =
  process.env.META_APP_SECRET?.trim() ||
  env.WHATSAPP_APP_SECRET ||
  undefined;

/**
 * Messenger (Facebook Page) credentials
 */
export const messengerVerifyToken =
  process.env.META_MESSENGER_VERIFY_TOKEN?.trim() ||
  process.env.META_VERIFY_TOKEN?.trim() ||
  env.WHATSAPP_VERIFY_TOKEN ||
  (isProduction ? undefined : "anei-meta-verify-token");

export const messengerPageAccessToken =
  process.env.META_PAGE_ACCESS_TOKEN?.trim() ||
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() ||
  undefined;

export function isMessengerConfigured(): boolean {
  return Boolean(messengerPageAccessToken && metaAppSecret && messengerVerifyToken);
}
export const messengerConfigured = isMessengerConfigured();

/**
 * Instagram Direct credentials
 */
export const instagramVerifyToken =
  process.env.META_INSTAGRAM_VERIFY_TOKEN?.trim() ||
  process.env.META_VERIFY_TOKEN?.trim() ||
  env.WHATSAPP_VERIFY_TOKEN ||
  (isProduction ? undefined : "anei-meta-verify-token");

export const instagramAccessToken =
  process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim() ||
  messengerPageAccessToken ||
  undefined;

export function isInstagramConfigured(): boolean {
  return Boolean(instagramAccessToken && metaAppSecret && instagramVerifyToken);
}
export const instagramConfigured = isInstagramConfigured();
