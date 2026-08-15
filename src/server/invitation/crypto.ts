import crypto from "node:crypto";
import { env } from "@/server/env";

/**
 * Phase 6 token/code primitives.
 *
 * Invitation token: 256 bits of CSPRNG entropy, transmitted once in the
 * WhatsApp link, stored ONLY as a SHA-256 digest. The token itself has high
 * entropy, so a plain keyed-agnostic SHA-256 digest is safe (the spec's
 * documented choice) — the practical attack is credential theft at rest, and
 * the digest defeats that.
 *
 * OTP: 6 decimal digits from a CSPRNG. Stored ONLY as a keyed HMAC-SHA256
 * digest derived from a server secret (BETTER_AUTH_SECRET + domain
 * separation) — never the raw code and never a plain hash that would allow
 * offline brute force. Verification is constant-time.
 *
 * No raw token/code ever leaves the caller for storage or logging.
 */

/**
 * Derives the OTP keying secret from the deployment's Better Auth secret.
 * Domain separation keeps this key independent of every other use of
 * BETTER_AUTH_SECRET; production requires a strong BETTER_AUTH_SECRET (see
 * src/server/env.ts).
 */
function otpHmacKey(): Buffer {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update("anei:invitation-otp:v1").digest();
}

export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Keyed digest of an OTP code. The challenge id is bound into the digest so a
 * code can never be replayed against a different challenge, and the
 * invitation id keeps digests scoped even if the key were ever rotated.
 */
export function digestOtpCode(invitationId: string, challengeId: string, code: string): string {
  return crypto
    .createHmac("sha256", otpHmacKey())
    .update(`${invitationId}:${challengeId}:${code}`)
    .digest("hex");
}

/** Constant-time comparison of a presented code against a stored digest. */
export function verifyOtpCode(invitationId: string, challengeId: string, code: string, expectedDigest: string): boolean {
  const candidate = digestOtpCode(invitationId, challengeId, code);
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expectedDigest, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}