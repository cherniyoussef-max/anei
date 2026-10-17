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
        signal: AbortSignal.timeout(10_000),
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

/**
 * Requests a direct-upload URL from Cloudflare Stream so an administrator's
 * browser can upload a video file directly to Cloudflare without routing
 * gigabytes of video binary through Vercel serverless functions (which have a
 * 4.5MB payload limit and incur high bandwidth costs).
 *
 * The returned uid is the permanent 32-character video identifier, pre-allocated
 * by Cloudflare before the upload begins.
 */
export async function createStreamDirectUpload(options?: { maxDurationSeconds?: number; expiryMinutes?: number }) {
  if (!cloudflareStreamConfigured) throw new MediaConfigurationError("CLOUDFLARE_STREAM_NOT_CONFIGURED");

  const maxDurationSeconds = options?.maxDurationSeconds ?? 14400; // 4 hours maximum
  const expiryMinutes = options?.expiryMinutes ?? 60; // 1 hour upload window
  const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds,
          expiry,
          requireSignedURLs: true,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new MediaProviderError("STREAM_DIRECT_UPLOAD_REQUEST_FAILED");
  }

  if (!response.ok) throw new MediaProviderError("STREAM_DIRECT_UPLOAD_REQUEST_FAILED");

  const data = (await response.json().catch(() => null)) as {
    success?: boolean;
    result?: { uploadURL?: string; uid?: string };
  } | null;

  if (!data?.success || !data.result?.uploadURL || !data.result?.uid) {
    throw new MediaProviderError("STREAM_DIRECT_UPLOAD_REQUEST_FAILED");
  }

  return {
    uploadUrl: data.result.uploadURL,
    uid: data.result.uid,
  };
}

