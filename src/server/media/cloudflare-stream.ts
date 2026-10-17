import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { videoAssets, lessons, type VideoAssetRow } from "@/server/db/schema";
import { env, cloudflareStreamConfigured } from "@/server/env";
import { logger } from "@/server/security/logger";

export class MediaConfigurationError extends Error {}
export class MediaProviderError extends Error {}

const STREAM_UID_PATTERN = /^[a-f0-9]{32}$/;

export function isValidStreamUid(value: string): boolean {
  return STREAM_UID_PATTERN.test(value.trim());
}

export interface DirectUploadSessionOptions {
  filename?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  maxDurationSeconds?: number;
  expiryMinutes?: number;
  lessonId?: string | null;
  courseId?: string | null;
  adminId?: string | null;
}

export interface DirectUploadSessionResult {
  assetId: string;
  uploadUrl: string;
  cloudflareUid: string;
  provider: "CLOUDFLARE_STREAM" | "CLOUDFLARE_R2" | "LOCAL_DEV";
  requireSignedUrls: boolean;
}

/**
 * Creates a pre-signed Direct Upload Session for videos.
 * Intelligent Hybrid Mode:
 * - If Cloudflare Stream is configured, requests a direct creator upload URL from Cloudflare.
 * - If not configured, transparently routes to the local development stream engine.
 * Records the asset in PostgreSQL `video_assets` table.
 */
export async function createDirectUploadSession(
  options: DirectUploadSessionOptions = {},
): Promise<DirectUploadSessionResult> {
  const maxDurationSeconds = options.maxDurationSeconds ?? 14400; // 4 hours max
  const expiryMinutes = options.expiryMinutes ?? 60;
  const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
  const filename = (options.filename || "video.mp4").trim();
  const fileSizeBytes = options.fileSizeBytes ?? 0;
  const mimeType = options.mimeType || "video/mp4";

  // Hybrid Mode: Cloudflare Stream
  if (cloudflareStreamConfigured) {
    const apiToken = env.CLOUDFLARE_STREAM_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            maxDurationSeconds,
            expiry,
            requireSignedURLs: true,
            meta: {
              name: filename,
              lessonId: options.lessonId || undefined,
              courseId: options.courseId || undefined,
            },
          }),
          signal: AbortSignal.timeout(12_000),
        },
      );
    } catch (err) {
      logger.error("cloudflare_stream.direct_upload_network_error", { error: String(err) });
      throw new MediaProviderError("STREAM_DIRECT_UPLOAD_REQUEST_FAILED");
    }

    if (!response.ok) {
      logger.error("cloudflare_stream.direct_upload_api_error", { status: response.status });
      throw new MediaProviderError("STREAM_DIRECT_UPLOAD_REQUEST_FAILED");
    }

    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      result?: { uploadURL?: string; uid?: string };
    } | null;

    if (!data?.success || !data.result?.uploadURL || !data.result?.uid) {
      throw new MediaProviderError("STREAM_DIRECT_UPLOAD_REQUEST_FAILED");
    }

    const cloudflareUid = data.result.uid;
    const uploadUrl = data.result.uploadURL;

    // Record asset in DB
    const [asset] = await db
      .insert(videoAssets)
      .values({
        lessonId: options.lessonId || null,
        courseId: options.courseId || null,
        provider: "CLOUDFLARE_STREAM",
        cloudflareUid,
        originalFilename: filename,
        fileSizeBytes,
        mimeType,
        status: "UPLOADING",
        encodingProgressPercent: 0,
        requireSignedUrls: true,
        uploadedByAdminId: options.adminId || null,
      })
      .returning();

    return {
      assetId: asset.id,
      uploadUrl,
      cloudflareUid,
      provider: "CLOUDFLARE_STREAM",
      requireSignedUrls: true,
    };
  }

  // Hybrid Fallback: Local Stream Engine
  const localMockUid = crypto.randomUUID().replace(/-/g, "");
  const [asset] = await db
    .insert(videoAssets)
    .values({
      lessonId: options.lessonId || null,
      courseId: options.courseId || null,
      provider: "LOCAL_DEV",
      cloudflareUid: localMockUid,
      originalFilename: filename,
      fileSizeBytes,
      mimeType,
      status: "UPLOADING",
      encodingProgressPercent: 0,
      requireSignedUrls: false,
      uploadedByAdminId: options.adminId || null,
    })
    .returning();

  return {
    assetId: asset.id,
    uploadUrl: `/api/admin/media/video/local-upload?assetId=${asset.id}`,
    cloudflareUid: localMockUid,
    provider: "LOCAL_DEV",
    requireSignedUrls: false,
  };
}

/**
 * Synchronizes and updates the video asset status from Cloudflare Stream or local engine.
 * Automatically updates PostgreSQL database and attaches the video UID & duration to the lesson.
 */
export async function syncVideoAssetStatus(identifier: { assetId?: string; cloudflareUid?: string }) {
  let asset: VideoAssetRow | undefined;
  if (identifier.assetId) {
    const rows = await db.select().from(videoAssets).where(eq(videoAssets.id, identifier.assetId)).limit(1);
    asset = rows[0];
  } else if (identifier.cloudflareUid) {
    const rows = await db.select().from(videoAssets).where(eq(videoAssets.cloudflareUid, identifier.cloudflareUid)).limit(1);
    asset = rows[0];
  }

  if (!asset) {
    throw new MediaProviderError("ASSET_NOT_FOUND");
  }

  // If already marked READY and has duration, return cached state
  if (asset.status === "READY" && asset.durationSeconds > 0) {
    return {
      asset,
      isReady: true,
      progressPercent: 100,
      durationSeconds: asset.durationSeconds,
      thumbnailUrl: asset.thumbnailUrl,
      playbackHlsUrl: asset.playbackHlsUrl,
    };
  }

  // CLOUDFLARE STREAM POLLING
  if (asset.provider === "CLOUDFLARE_STREAM" && cloudflareStreamConfigured) {
    const apiToken = env.CLOUDFLARE_STREAM_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${asset.cloudflareUid}`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (response.ok) {
        const payload = (await response.json()) as {
          success?: boolean;
          result?: {
            status?: { state?: string; pctComplete?: string; errorReasonCode?: string };
            duration?: number;
            thumbnail?: string;
            playback?: { hls?: string; dash?: string };
          };
        };

        if (payload.success && payload.result) {
          const res = payload.result;
          const state = res.status?.state;

          if (state === "ready") {
            const duration = Math.max(1, Math.round(res.duration ?? 0));
            const customerCode = env.CLOUDFLARE_STREAM_CUSTOMER_CODE || "customer";
            const thumbnail =
              res.thumbnail ||
              `https://customer-${customerCode}.cloudflarestream.com/${asset.cloudflareUid}/thumbnails/thumbnail.jpg`;
            const hls =
              res.playback?.hls ||
              `https://customer-${customerCode}.cloudflarestream.com/${asset.cloudflareUid}/manifest/video.m3u8`;
            const dash =
              res.playback?.dash ||
              `https://customer-${customerCode}.cloudflarestream.com/${asset.cloudflareUid}/manifest/video.mpd`;

            const [updatedAsset] = await db
              .update(videoAssets)
              .set({
                status: "READY",
                encodingProgressPercent: 100,
                durationSeconds: duration,
                thumbnailUrl: thumbnail,
                playbackHlsUrl: hls,
                playbackDashUrl: dash,
                updatedAt: new Date(),
              })
              .where(eq(videoAssets.id, asset.id))
              .returning();

            // Auto-attach to lesson if linked
            if (updatedAsset.lessonId) {
              await db
                .update(lessons)
                .set({
                  mediaProvider: "cloudflare_stream",
                  mediaRef: updatedAsset.cloudflareUid,
                  durationSeconds: duration,
                })
                .where(eq(lessons.id, updatedAsset.lessonId));
            }

            return {
              asset: updatedAsset,
              isReady: true,
              progressPercent: 100,
              durationSeconds: duration,
              thumbnailUrl: thumbnail,
              playbackHlsUrl: hls,
            };
          }

          if (state === "inprogress" || state === "queued") {
            const pct = Math.min(99, Math.max(5, Math.round(Number(res.status?.pctComplete) || 50)));
            const [updatedAsset] = await db
              .update(videoAssets)
              .set({
                status: "PROCESSING",
                encodingProgressPercent: pct,
                updatedAt: new Date(),
              })
              .where(eq(videoAssets.id, asset.id))
              .returning();

            return {
              asset: updatedAsset,
              isReady: false,
              progressPercent: pct,
              durationSeconds: 0,
              thumbnailUrl: null,
              playbackHlsUrl: null,
            };
          }

          if (state === "error") {
            const [updatedAsset] = await db
              .update(videoAssets)
              .set({
                status: "ERROR",
                updatedAt: new Date(),
              })
              .where(eq(videoAssets.id, asset.id))
              .returning();

            return {
              asset: updatedAsset,
              isReady: false,
              progressPercent: 0,
              durationSeconds: 0,
              thumbnailUrl: null,
              playbackHlsUrl: null,
            };
          }
        }
      }
    } catch (err) {
      logger.warn("cloudflare_stream.sync_status_polling_failed", { error: String(err) });
    }
  }

  // LOCAL DEV ENGINE: Auto-transition to READY
  if (asset.provider === "LOCAL_DEV") {
    const mockDuration = asset.durationSeconds > 0 ? asset.durationSeconds : 720; // 12 minutes default
    const mockThumbnail = "/demo/video-poster.svg";
    const mockHls = "/demo/video.mp4";

    const [updatedAsset] = await db
      .update(videoAssets)
      .set({
        status: "READY",
        encodingProgressPercent: 100,
        durationSeconds: mockDuration,
        thumbnailUrl: mockThumbnail,
        playbackHlsUrl: mockHls,
        updatedAt: new Date(),
      })
      .where(eq(videoAssets.id, asset.id))
      .returning();

    if (updatedAsset.lessonId) {
      await db
        .update(lessons)
        .set({
          mediaProvider: "cloudflare_stream",
          mediaRef: updatedAsset.cloudflareUid,
          durationSeconds: mockDuration,
        })
        .where(eq(lessons.id, updatedAsset.lessonId));
    }

    return {
      asset: updatedAsset,
      isReady: true,
      progressPercent: 100,
      durationSeconds: mockDuration,
      thumbnailUrl: mockThumbnail,
      playbackHlsUrl: mockHls,
    };
  }

  return {
    asset,
    isReady: asset.status === "READY",
    progressPercent: asset.encodingProgressPercent,
    durationSeconds: asset.durationSeconds,
    thumbnailUrl: asset.thumbnailUrl,
    playbackHlsUrl: asset.playbackHlsUrl,
  };
}

/**
 * Generates a signed playback token for a Cloudflare Stream video.
 * Validates against Cloudflare signing key or delegates to Cloudflare /token endpoint.
 * In local dev mode, generates a valid local playback token.
 */
export async function generateSignedPlaybackToken(
  cloudflareUid: string,
  viewerUserId: string,
  expiresInSeconds = 7200,
) {
  if (!isValidStreamUid(cloudflareUid)) {
    throw new MediaProviderError("INVALID_STREAM_UID");
  }

  // If Cloudflare Stream is configured:
  if (cloudflareStreamConfigured) {
    const customerCode = env.CLOUDFLARE_STREAM_CUSTOMER_CODE || "customer";
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

    // Method A: If private RSA signing key is provided in .env
    if (env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM && env.CLOUDFLARE_STREAM_SIGNING_KEY_ID) {
      try {
        const header = {
          alg: "RS256",
          kid: env.CLOUDFLARE_STREAM_SIGNING_KEY_ID,
        };
        const payload = {
          sub: cloudflareUid,
          kid: env.CLOUDFLARE_STREAM_SIGNING_KEY_ID,
          exp,
          nbf: Math.floor(Date.now() / 1000) - 30,
          downloadable: false,
          user: viewerUserId,
        };

        const b64Url = (obj: object) =>
          Buffer.from(JSON.stringify(obj)).toString("base64url");
        const unsignedToken = `${b64Url(header)}.${b64Url(payload)}`;

        const signer = crypto.createSign("RSA-SHA256");
        signer.update(unsignedToken);
        const signature = signer.sign(env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM, "base64url");
        const token = `${unsignedToken}.${signature}`;

        return {
          provider: "cloudflare_stream" as const,
          token,
          iframeUrl: `https://customer-${customerCode}.cloudflarestream.com/${token}/iframe`,
          hlsUrl: `https://customer-${customerCode}.cloudflarestream.com/${token}/manifest/video.m3u8`,
          expiresAt: new Date(exp * 1000).toISOString(),
        };
      } catch (err) {
        logger.warn("cloudflare_stream.local_jwt_sign_failed_falling_back_to_api", { error: String(err) });
      }
    }

    // Method B: Cloudflare Token API delegation
    const apiToken = env.CLOUDFLARE_STREAM_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${cloudflareUid}/token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
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

    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      result?: { token?: string };
    } | null;

    if (!data?.success || !data.result?.token) {
      throw new MediaProviderError("STREAM_TOKEN_REQUEST_FAILED");
    }

    return {
      provider: "cloudflare_stream" as const,
      token: data.result.token,
      iframeUrl: `https://customer-${customerCode}.cloudflarestream.com/${data.result.token}/iframe`,
      hlsUrl: `https://customer-${customerCode}.cloudflarestream.com/${data.result.token}/manifest/video.m3u8`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  // Local Dev Fallback Engine
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    provider: "local_dev" as const,
    token: `local_dev_token_${viewerUserId}`,
    iframeUrl: `/demo/player.html?uid=${cloudflareUid}`,
    hlsUrl: `/demo/video.mp4`,
    localUrl: `/demo/video.mp4`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Backward-compatible helper for getStreamPlayback
 */
export async function getStreamPlayback(videoUid: string) {
  if (!cloudflareStreamConfigured) throw new MediaConfigurationError("CLOUDFLARE_STREAM_NOT_CONFIGURED");
  if (!isValidStreamUid(videoUid)) throw new MediaProviderError("INVALID_STREAM_UID");
  return generateSignedPlaybackToken(videoUid, "learner", env.STORAGE_MEDIA_URL_TTL_SECONDS);
}

/**
 * Backward-compatible helper for createStreamDirectUpload
 */
export async function createStreamDirectUpload(options?: { maxDurationSeconds?: number; expiryMinutes?: number }) {
  const session = await createDirectUploadSession(options);
  return {
    uploadUrl: session.uploadUrl,
    uid: session.cloudflareUid,
  };
}

/**
 * Verifies the HMAC-SHA256 signature sent by Cloudflare Stream webhooks.
 * Header format: Webhook-Signature: time=123456789,sig1=abcdef...
 */
export function verifyStreamWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret?: string,
): boolean {
  const webhookSecret = secret || env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  if (!webhookSecret || !signatureHeader) return false;

  const parts = signatureHeader.split(",");
  let time = "";
  let sig1 = "";

  for (const part of parts) {
    const [k, v] = part.trim().split("=");
    if (k === "time") time = v;
    if (k === "sig1") sig1 = v;
  }

  if (!time || !sig1) return false;

  // Cloudflare signature is HMAC-SHA256 of `${time}.${rawBody}`
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${time}.${rawBody}`)
    .digest("hex");

  const sigBuffer = Buffer.from(sig1, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
