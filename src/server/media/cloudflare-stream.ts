import "server-only";
import { env, cloudflareStreamConfigured } from "@/server/env";

export class MediaConfigurationError extends Error {}
export class MediaProviderError extends Error {}

const STREAM_UID_PATTERN = /^[a-f0-9]{32}$/;

export function isValidStreamUid(value: string) {
  return STREAM_UID_PATTERN.test(value.trim());
}

/**
 * Requests a short-lived signed Cloudflare Stream playback token, scoped to
 * one video uid, via Cloudflare's own /token endpoint. This delegates JWT
 * signing to Cloudflare entirely (no private key material is generated,
 * stored, or signed by ANEI) and reuses the existing lesson-media playback
 * TTL (STORAGE_MEDIA_URL_TTL_SECONDS) rather than inventing a second TTL
 * knob for the same "how long can a viewer keep watching" concern that
 * signedMediaUrl() already governs for internal-storage lessons.
 */
export async function getStreamPlayback(videoUid: string) {
  if (!cloudflareStreamConfigured) throw new MediaConfigurationError("CLOUDFLARE_STREAM_NOT_CONFIGURED");
  if (!isValidStreamUid(videoUid)) throw new MediaProviderError("INVALID_STREAM_UID");

  const ttlSeconds = env.STORAGE_MEDIA_URL_TTL_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exp }),
      },
    );
  } catch {
    throw new MediaProviderError("STREAM_TOKEN_REQUEST_FAILED");
  }
  if (!response.ok) throw new MediaProviderError("STREAM_TOKEN_REQUEST_FAILED");

  const data = (await response.json().catch(() => null)) as { success?: boolean; result?: { token?: string } } | null;
  if (!data?.success || !data.result?.token) throw new MediaProviderError("STREAM_TOKEN_REQUEST_FAILED");

  return {
    provider: "cloudflare_stream" as const,
    iframeUrl: `https://customer-${env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${data.result.token}/iframe`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
