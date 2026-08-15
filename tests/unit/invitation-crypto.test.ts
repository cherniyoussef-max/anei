/**
 * Phase 6 invitation/OTP cryptographic primitives (src/server/invitation/crypto.ts).
 * These are pure functions (node:crypto) with no DB dependency, so they are
 * exercised directly here: token entropy/shape, digest-only storage contract,
 * keyed HMAC digests, and constant-time verification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  digestOtpCode,
  generateInvitationToken,
  generateOtpCode,
  hashInvitationToken,
  verifyOtpCode,
} from "../../src/server/invitation/crypto";

test("generateInvitationToken: 256 bits of CSPRNG entropy, base64url, no secrets leaked in shape", () => {
  const token = generateInvitationToken();
  assert.equal(typeof token, "string");
  assert.ok(token.length >= 40 && token.length <= 200, "token must be within the valid bearer length window");
  assert.match(token, /^[A-Za-z0-9_-]+$/, "tokens must be URL-safe base64url");
  assert.notEqual(token, generateInvitationToken(), "tokens must be unique");
});

test("hashInvitationToken: produces the deterministic SHA-256 hex digest of the raw token, never the token itself", () => {
  const token = generateInvitationToken();
  const digest = hashInvitationToken(token);
  assert.equal(digest.length, 64, "a SHA-256 digest is 64 hex chars");
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, hashInvitationToken(token), "the digest must be deterministic");
  assert.notEqual(digest, token, "the stored form must never equal the raw token");
  const expected = crypto.createHash("sha256").update(token).digest("hex");
  assert.equal(digest, expected);
});

test("generateOtpCode: always exactly 6 decimal digits from a CSPRNG", () => {
  const code = generateOtpCode();
  assert.match(code, /^\d{6}$/, `got ${code}`);
  assert.notEqual(code, generateOtpCode(), "codes must vary");
});

test("digestOtpCode: a keyed HMAC-SHA256 digest that binds invitation + challenge, so a code cannot be replayed", () => {
  const invitationId = crypto.randomUUID();
  const challengeId = crypto.randomUUID();
  const code = "123456";
  const d1 = digestOtpCode(invitationId, challengeId, code);
  assert.equal(d1.length, 64);
  assert.match(d1, /^[0-9a-f]{64}$/);
  assert.notEqual(d1, code, "the raw code must never be derivable from the stored form");
  assert.equal(d1, digestOtpCode(invitationId, challengeId, code), "digests are deterministic");
  assert.notEqual(d1, digestOtpCode(crypto.randomUUID(), challengeId, code), "a different invitation must produce a different digest");
  assert.notEqual(d1, digestOtpCode(invitationId, crypto.randomUUID(), code), "a different challenge must produce a different digest");
  assert.notEqual(d1, digestOtpCode(invitationId, challengeId, "999999"), "a different code must produce a different digest");
});

test("verifyOtpCode: accepts the correct code and rejects wrong ones in constant time", () => {
  const invitationId = crypto.randomUUID();
  const challengeId = crypto.randomUUID();
  const code = "000001";
  const digest = digestOtpCode(invitationId, challengeId, code);
  assert.equal(verifyOtpCode(invitationId, challengeId, code, digest), true);
  assert.equal(verifyOtpCode(invitationId, challengeId, "000000", digest), false);
  assert.equal(verifyOtpCode(invitationId, challengeId, code, digestOtpCode(invitationId, challengeId, "000000")), false);
  assert.equal(verifyOtpCode(invitationId, challengeId, code, "not-a-hex-digest"), false, "malformed stored digests are rejected");
  assert.equal(verifyOtpCode(invitationId, challengeId, "999999", digest), false);
});