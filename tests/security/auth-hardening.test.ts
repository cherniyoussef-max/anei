import test from "node:test";
import assert from "node:assert/strict";
import { enforceNewUserDefaults } from "@/server/auth/policy";
import { auth } from "@/server/auth";
import {
  AUTH_OTP_LENGTH,
  AUTH_OTP_MAX_ATTEMPTS,
  AUTH_OTP_RESEND_COOLDOWN_SECONDS,
  AUTH_OTP_TTL_MINUTES,
  AUTH_RESET_TOKEN_TTL_MINUTES,
  digestEqual,
  generateAuthOtp,
  generateResetAuthorizationToken,
  hashAuthOtp,
  hashResetAuthorizationToken,
} from "@/server/security/auth-otp-crypto";

test("enforceNewUserDefaults: forces role to USER even if client attempts privilege escalation", () => {
  const result1 = enforceNewUserDefaults({ email: "test@example.com", role: "ADMIN" });
  assert.equal(result1.role, "USER");

  const result2 = enforceNewUserDefaults({ email: "test@example.com", role: "SUPER_ADMIN" });
  assert.equal(result2.role, "USER");

  const result3 = enforceNewUserDefaults({ email: "test@example.com" });
  assert.equal(result3.role, "USER");
});

test("enforceNewUserDefaults: rejects unsupported/malicious profileType values", () => {
  assert.throws(
    () => enforceNewUserDefaults({ email: "test@example.com", profileType: "root" }),
    (err: unknown) => {
      return err instanceof Error && (err.message.includes("profileType") || err.name === "APIError");
    },
  );

  assert.throws(
    () => enforceNewUserDefaults({ email: "test@example.com", profileType: "admin" }),
    (err: unknown) => {
      return err instanceof Error && (err.message.includes("profileType") || err.name === "APIError");
    },
  );
});

test("enforceNewUserDefaults: preserves legitimate profileType and validates locale", () => {
  const validProfiles = ["learner", "teacher", "avs", "parent", "specialist", "institution"] as const;
  for (const pt of validProfiles) {
    const res = enforceNewUserDefaults({ email: "test@example.com", profileType: pt, locale: "ar" });
    assert.equal(res.profileType, pt);
    assert.equal(res.locale, "ar");
  }

  const defaultLocale = enforceNewUserDefaults({ email: "test@example.com", locale: "invalid" });
  assert.equal(defaultLocale.locale, "fr");
});

test("Better Auth configuration: strict password policies and credential protection", () => {
  const emailAndPassword = auth.options.emailAndPassword;
  assert.ok(emailAndPassword);
  assert.ok(emailAndPassword.minPasswordLength >= 15, "minPasswordLength must be at least 15");
  assert.ok(emailAndPassword.maxPasswordLength <= 128, "maxPasswordLength must be at most 128");
  assert.equal(emailAndPassword.revokeSessionsOnPasswordReset, true, "Sessions must be revoked on password reset");

  const additionalRoleField = auth.options.user?.additionalFields?.role as { input?: boolean } | undefined;
  assert.equal(additionalRoleField?.input, false, "role must not be accepted via client registration input");

  const account = auth.options.account;
  assert.equal(account?.encryptOAuthTokens, true, "OAuth tokens must be encrypted in storage");
});

test("OTP crypto primitives: length, timing safety, and HMAC hashing", () => {
  assert.equal(AUTH_OTP_LENGTH, 6);
  assert.ok(AUTH_OTP_TTL_MINUTES <= 10, "OTP TTL must be <= 10 minutes");
  assert.ok(AUTH_OTP_MAX_ATTEMPTS <= 5, "OTP max attempts must be <= 5");
  assert.equal(AUTH_OTP_RESEND_COOLDOWN_SECONDS, 60);
  assert.ok(AUTH_RESET_TOKEN_TTL_MINUTES <= 15, "Reset token TTL must be <= 15 minutes");

  const otp = generateAuthOtp();
  assert.match(otp, /^\d{6}$/);

  const challengeId = "00000000-0000-0000-0000-000000000001";
  const hash1 = hashAuthOtp(challengeId, otp);
  const hash2 = hashAuthOtp(challengeId, otp);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 hex length

  const differentHash = hashAuthOtp(challengeId, "999999");
  assert.notEqual(hash1, differentHash);

  assert.equal(digestEqual(hash1, hash2), true);
  assert.equal(digestEqual(hash1, differentHash), false);
  assert.equal(digestEqual(hash1, "invalid_length"), false);
});

test("Password reset token primitives: cryptographic entropy and HMAC hashing", () => {
  const token = generateResetAuthorizationToken();
  assert.ok(token.length >= 32);

  const hash = hashResetAuthorizationToken(token);
  assert.equal(hash.length, 64);
  assert.equal(hashResetAuthorizationToken(token), hash);
});
