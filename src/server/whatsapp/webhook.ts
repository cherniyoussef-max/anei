import crypto from "node:crypto";
import { readLimitedRawBody } from "@/server/security/request-body";

/**
 * Official Meta Webhook security primitives (WhatsApp, Messenger, Instagram).
 *
 * Two distinct mechanisms — keep them separate:
 *  - The GET **verification handshake** (hub.mode/hub.verify_token/hub.challenge)
 *    proves we own the callback URL once, during Meta dashboard setup.
 *  - Every POST delivery is signed with `X-Hub-Signature-256` —
 *    HMAC-SHA256 of the RAW request body keyed with the Meta app secret.
 *    The signature is NOT a substitute for (nor interchangeable with) the
 *    verify token. It must be checked against the raw bytes, never a parsed
 *    and re-serialized body.
 *
 * Neither primitive ever logs its inputs.
 */

const PREFIX = "sha256=";
export const MAX_META_WEBHOOK_BODY_BYTES = 256 * 1024;

/**
 * Constant-time comparison of `X-Hub-Signature-256` against a recomputed
 * HMAC-SHA256 (hex) of the raw body. Missing/malformed headers, empty secrets,
 * and any length mismatch fail closed.
 */
export function verifyWebhookSignature(
  rawBody: Uint8Array | Buffer | string,
  signatureHeader: string | null | undefined,
  appSecret: string | undefined,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.startsWith(PREFIX) ? signatureHeader.slice(PREFIX.length) : signatureHeader;
  const bufProvided = Buffer.from(provided, "utf8");
  const bufExpected = Buffer.from(expected, "utf8");
  if (bufProvided.byteLength !== bufExpected.byteLength) return false;
  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Meta's GET verification handshake: respond 200 with the raw hub.challenge
 * only when hub.mode === "subscribe" and hub.verify_token matches the
 * configured token. Verified in constant time. Any other combination fails closed.
 */
export function verifyWebhookChallenge(
  params: { mode: string | null; verifyToken: string | null; challenge: string | null },
  expectedToken: string | null | undefined,
): boolean {
  if (!expectedToken || !params.verifyToken || params.mode !== "subscribe" || !params.challenge) {
    return false;
  }
  const bufProvided = Buffer.from(params.verifyToken, "utf8");
  const bufExpected = Buffer.from(expectedToken, "utf8");
  if (bufProvided.byteLength !== bufExpected.byteLength) {
    return false;
  }
  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

export interface ProcessMetaWebhookOptions {
  appSecret: string | undefined;
  maxBytes?: number;
}

export type ProcessMetaWebhookResult<T = unknown> =
  | { ok: true; raw: Buffer; parsed: T }
  | {
      ok: false;
      status: 400 | 401 | 413 | 500;
      error: "MISCONFIGURED" | "PAYLOAD_TOO_LARGE" | "MISSING_SIGNATURE" | "INVALID_SIGNATURE" | "MALFORMED_JSON";
    };

function isLocalUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * Shared helper for all Meta webhooks (Instagram, Messenger, WhatsApp):
 * 1. Checks appSecret is configured (fails closed with 500 if unset)
 * 2. Reads raw body with hard byte limit (fails with 413 if exceeded)
 * 3. Requires X-Hub-Signature-256 header (fails with 401 if missing)
 * 4. Verifies HMAC-SHA256 signature in constant time (fails with 401 if invalid)
 * 5. Parses JSON only AFTER signature verification (fails with 400 if malformed)
 */
export async function parseAndVerifyMetaWebhook<T = unknown>(
  request: Request,
  options: ProcessMetaWebhookOptions,
): Promise<ProcessMetaWebhookResult<T>> {
  const allowUnsigned =
    process.env.META_WEBHOOK_ALLOW_UNSIGNED === "true" &&
    process.env.NODE_ENV === "development" &&
    isLocalUrl(process.env.APP_URL || "http://localhost:3000");

  if (!options.appSecret) {
    if (allowUnsigned) {
      const maxBytes = options.maxBytes ?? MAX_META_WEBHOOK_BODY_BYTES;
      const raw = await readLimitedRawBody(request, maxBytes).catch(() => null);
      if (!raw) {
        return { ok: false, status: 413, error: "PAYLOAD_TOO_LARGE" };
      }
      try {
        const parsed = JSON.parse(raw.toString("utf8")) as T;
        return { ok: true, raw, parsed };
      } catch {
        return { ok: false, status: 400, error: "MALFORMED_JSON" };
      }
    }
    return { ok: false, status: 500, error: "MISCONFIGURED" };
  }

  const maxBytes = options.maxBytes ?? MAX_META_WEBHOOK_BODY_BYTES;
  const raw = await readLimitedRawBody(request, maxBytes).catch(() => null);
  if (!raw) {
    return { ok: false, status: 413, error: "PAYLOAD_TOO_LARGE" };
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  if (!signatureHeader) {
    return { ok: false, status: 401, error: "MISSING_SIGNATURE" };
  }

  const verified = verifyWebhookSignature(raw, signatureHeader, options.appSecret);
  if (!verified) {
    return { ok: false, status: 401, error: "INVALID_SIGNATURE" };
  }

  try {
    const parsed = JSON.parse(raw.toString("utf8")) as T;
    return { ok: true, raw, parsed };
  } catch {
    return { ok: false, status: 400, error: "MALFORMED_JSON" };
  }
}

/** Builds the idempotency ledger key for a single webhook event. */
export function webhookStableKey(kind: "message" | "status", providerMessageId: string, extra?: string): string {
  return extra ? `${kind}:${providerMessageId}:${extra}` : `${kind}:${providerMessageId}`;
}