import "server-only";
import crypto from "node:crypto";
import { env } from "@/server/env";

/**
 * Phase 6 invitation/OTP crypto. Keyed with the deployment's existing
 * BETTER_AUTH_SECRET (the same server-only secret already used for the
 * mock-payment HMAC and the Meta webhook signature check) rather than a new
 * secret, with domain-separation prefixes so a token digest, an OTP digest
 * and any other keyed use can never collide. Neither the raw invitation
 * token nor the raw OTP is ever persisted — only these HMAC digests are.
 */

export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_TOKEN_TTL_HOURS = 72;
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Generates a high-entropy, URL-safe invitation secret. Never logged, never stored raw. */
export function generateInvitationToken(): string {
  return crypto.randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

/** HMAC-SHA256 digest of an invitation token. Domain-separated from the OTP digest below. */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(`invitation:v1:${rawToken}`).digest("hex");
}

/**
 * Cryptographically secure six-digit OTP (never Math.random()). Zero-padded
 * so the digit count is constant regardless of value.
 */
export function generateOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

/**
 * Keyed digest of an OTP, bound to its owning challenge id so the same
 * six-digit value never hashes identically across two different challenges
 * (a plain unsalted SHA-256 of a six-digit code would be brute-forceable
 * offline in a fraction of a second; this keyed, per-challenge construction
 * is not).
 */
export function hashOtp(challengeId: string, otp: string): string {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(`otp:v1:${challengeId}:${otp}`).digest("hex");
}

/** Constant-time digest comparison (both inputs are fixed-length hex digests). */
export function digestsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
