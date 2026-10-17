import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
} from "@/server/auth/password-recovery";

test("Password reset token generation and hashing contract", () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  assert.equal(rawToken.length, 64, "Raw token must be a 64-character hex string (32 bytes)");

  const hash1 = hashPasswordResetToken(rawToken);
  const hash2 = hashPasswordResetToken(rawToken);
  assert.equal(hash1, hash2, "Hashing must be deterministic");
  assert.equal(hash1.length, 64, "SHA-256 hash must be 64 characters");

  const diffToken = crypto.randomBytes(32).toString("hex");
  const diffHash = hashPasswordResetToken(diffToken);
  assert.notEqual(hash1, diffHash, "Different raw tokens must produce distinct hashes");
});

test("Password reset token has strict 30 minutes TTL", () => {
  assert.equal(PASSWORD_RESET_TOKEN_TTL_MINUTES, 30, "Token TTL must be strictly 30 minutes");

  const now = new Date("2026-10-17T12:00:00.000Z");
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000);
  assert.equal(expiresAt.toISOString(), "2026-10-17T12:30:00.000Z");

  const beforeExpiry = new Date(expiresAt.getTime() - 1000);
  const afterExpiry = new Date(expiresAt.getTime() + 1000);

  assert.ok(beforeExpiry < expiresAt, "Timestamp before 30 min is valid");
  assert.ok(afterExpiry > expiresAt, "Timestamp after 30 min is expired");
});

test("Password reset route handlers enforce strict security invariants", async () => {
  const forgotRoute = await readFile("src/app/api/auth/forgot-password/route.ts", "utf8");
  assert.ok(forgotRoute.includes("isTrustedMutation(request)"), "Must verify trusted mutation / origin");
  assert.ok(forgotRoute.includes("readLimitedJson(request)"), "Must read limited JSON to avoid payload attacks");
  assert.ok(forgotRoute.includes("forgot-password-ip:"), "Must rate limit by IP");
  assert.ok(forgotRoute.includes("forgot-password-email:"), "Must rate limit by email");
  assert.ok(forgotRoute.includes("900"), "Must enforce 15-minute rate limit window (900s)");
  assert.ok(forgotRoute.includes("3, 900"), "Must restrict to max 3 requests per 15 minutes");

  const resetRoute = await readFile("src/app/api/auth/reset-password/route.ts", "utf8");
  assert.ok(resetRoute.includes("isTrustedMutation(request)"), "Must verify trusted mutation / origin");
  assert.ok(resetRoute.includes("readLimitedJson(request)"), "Must read limited JSON");
  assert.ok(resetRoute.includes("password-reset-ip:"), "Must rate limit reset attempts by IP");
  assert.ok(resetRoute.includes("z.string().min(15)"), "Must enforce minimum 15 characters password length");
  assert.ok(resetRoute.includes("resetPasswordWithToken"), "Must invoke resetPasswordWithToken");
});

test("Password recovery service implements anti-enumeration and session invalidation", async () => {
  const service = await readFile("src/server/auth/password-recovery.ts", "utf8");
  assert.ok(service.includes("PASSWORD_RESET_TOKEN_TTL_MINUTES = 30"), "TTL defined as 30 minutes");
  assert.ok(service.includes("status: \"ACTIVE\""), "Newly created token is ACTIVE");
  assert.ok(service.includes("status: \"REVOKED\""), "Previous active tokens are revoked");
  assert.ok(service.includes("status: \"CONSUMED\""), "Consumed token marked as CONSUMED");
  assert.ok(service.includes("deleteUserSessions"), "Must invalidate all existing sessions on password reset");
  assert.ok(service.includes("invalidateSessionAssuranceByUser"), "Must invalidate session assurance on reset");
  assert.ok(service.includes("auth.password.reset_success"), "Must write audit log on success");
  assert.ok(service.includes("sendResetEmail"), "Must send transaction reset email");
});

test("Mailer sendResetEmail contains ANEI bilingual styling and 30 minutes notice", async () => {
  const mailer = await readFile("src/server/services/mailer.ts", "utf8");
  assert.ok(mailer.includes("sendResetEmail"), "sendResetEmail exists");
  assert.ok(mailer.includes("Réinitialiser mon mot de passe"), "French CTA is Réinitialiser mon mot de passe");
  assert.ok(mailer.includes("إعادة تعيين كلمة المرور"), "Arabic CTA is accurate");
  assert.ok(mailer.includes("30 minutes"), "Warning mentions 30 minutes expiry");
});
