import crypto from "node:crypto";

/**
 * Official Meta WhatsApp Cloud API webhook security primitives.
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

/**
 * Constant-time comparison of `X-Hub-Signature-256` against a recomputed
 * HMAC-SHA256 (hex) of the raw body. Missing/malformed headers and any
 * length mismatch fail closed.
 */
export function verifyWebhookSignature(rawBody: Uint8Array | Buffer | string, signatureHeader: string | null | undefined, appSecret: string | undefined): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.startsWith(PREFIX) ? signatureHeader.slice(PREFIX.length) : signatureHeader;
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
}

/**
 * Meta's GET verification handshake: respond 200 with the raw hub.challenge
 * only when hub.mode === "subscribe" and hub.verify_token matches the
 * configured token. Any other combination fails closed.
 */
export function verifyWebhookChallenge(params: { mode: string | null; verifyToken: string | null; challenge: string | null }, expectedToken: string | null | undefined): boolean {
  if (!expectedToken || params.mode !== "subscribe" || !params.challenge) return false;
  return params.verifyToken === expectedToken;
}

/** Builds the idempotency ledger key for a single webhook event. */
export function webhookStableKey(kind: "message" | "status", providerMessageId: string, extra?: string): string {
  return extra ? `${kind}:${providerMessageId}:${extra}` : `${kind}:${providerMessageId}`;
}