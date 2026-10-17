import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  issueSudoToken,
  verifySudoToken,
  SUDO_SESSION_TTL_MS,
} from "@/server/auth/sudo";

test("Admin Sudo Mode: issues a valid cryptographically signed Sudo token", () => {
  const adminId = "a0000000-0000-0000-0000-000000000001";
  const { token, expiresAt } = issueSudoToken(adminId);
  assert.ok(token);
  assert.equal(token.split(".").length, 2);
  assert.ok(expiresAt.getTime() > Date.now());
  assert.equal(verifySudoToken(token, adminId), true);
});

test("Admin Sudo Mode: rejects token when verified against a different admin ID (privilege escalation prevention)", () => {
  const adminId = "a0000000-0000-0000-0000-000000000001";
  const intruderId = "b0000000-0000-0000-0000-000000000002";
  const { token } = issueSudoToken(adminId);
  assert.equal(verifySudoToken(token, intruderId), false);
});

test("Admin Sudo Mode: rejects tampered token payloads", () => {
  const adminId = "a0000000-0000-0000-0000-000000000001";
  const { token } = issueSudoToken(adminId);
  const [, signature] = token.split(".");
  const tamperedPayloadB64 = Buffer.from(
    JSON.stringify({ adminId, verifiedAt: Date.now(), expiresAt: Date.now() + SUDO_SESSION_TTL_MS + 100000 })
  ).toString("base64url");
  const tamperedToken = `${tamperedPayloadB64}.${signature}`;

  assert.equal(verifySudoToken(tamperedToken, adminId), false);
});

test("Admin Sudo Mode: rejects corrupted signatures", () => {
  const adminId = "a0000000-0000-0000-0000-000000000001";
  const { token } = issueSudoToken(adminId);
  const [payloadB64] = token.split(".");
  const fakeSignature = "0".repeat(64);
  assert.equal(verifySudoToken(`${payloadB64}.${fakeSignature}`, adminId), false);
});

test("Admin Sudo Mode: rejects expired tokens", () => {
  const adminId = "a0000000-0000-0000-0000-000000000001";
  const expiredPayload = {
    adminId,
    verifiedAt: Date.now() - SUDO_SESSION_TTL_MS - 1000,
    expiresAt: Date.now() - 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.BETTER_AUTH_SECRET || "development-insecure-secret-do-not-use-in-production-min-32-chars")
    .update(`anei:sudo:v1:${payloadB64}`)
    .digest("hex");

  assert.equal(verifySudoToken(`${payloadB64}.${sig}`, adminId), false);
});
