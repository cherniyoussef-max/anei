import "server-only";
import crypto from "node:crypto";
import { env } from "@/server/env";

export const AUTH_OTP_LENGTH = 6;
export const AUTH_OTP_TTL_MINUTES = 5;
export const AUTH_OTP_MAX_ATTEMPTS = 3;
export const AUTH_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const AUTH_RESET_TOKEN_TTL_MINUTES = 10;

export function generateAuthOtp(): string {
  return crypto.randomInt(0, 10 ** AUTH_OTP_LENGTH).toString().padStart(AUTH_OTP_LENGTH, "0");
}

export function hashAuthOtp(challengeId: string, otp: string): string {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(`anei:auth-otp:v1:${challengeId}:${otp}`).digest("hex");
}

export function generateResetAuthorizationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashResetAuthorizationToken(token: string): string {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(`anei:auth-reset:v1:${token}`).digest("hex");
}

export function digestEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
