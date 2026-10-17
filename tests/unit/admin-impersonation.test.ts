import test from "node:test";
import assert from "node:assert/strict";
import {
  signImpersonationToken,
  verifyImpersonationToken,
  IMPERSONATION_TTL_MS,
  type ImpersonationPayload,
} from "@/server/auth/impersonation";

const payload: ImpersonationPayload = {
  impersonatorId: "a0000000-0000-0000-0000-000000000001",
  impersonatorName: "Super Admin Youssef",
  impersonatorEmail: "admin@anei.tn",
  targetUserId: "u0000000-0000-0000-0000-000000000009",
  targetUserName: "Karim Ben Ali",
  targetUserEmail: "karim@example.com",
  startedAt: Date.now(),
  expiresAt: Date.now() + IMPERSONATION_TTL_MS,
};

test("Admin Impersonation: signs and verifies a valid impersonation token with dual-identity claims", () => {
  const token = signImpersonationToken(payload);
  assert.ok(token);
  assert.equal(token.split(".").length, 2);

  const verified = verifyImpersonationToken(token);
  assert.notEqual(verified, null);
  assert.equal(verified?.impersonatorId, payload.impersonatorId);
  assert.equal(verified?.targetUserId, payload.targetUserId);
  assert.equal(verified?.targetUserEmail, "karim@example.com");
});

test("Admin Impersonation: rejects tampered impersonation payload (e.g. attempting to switch target user)", () => {
  const token = signImpersonationToken(payload);
  const [, signature] = token.split(".");

  const tamperedPayload: ImpersonationPayload = {
    ...payload,
    targetUserId: "u0000000-0000-0000-0000-000000000999", // switched target
  };
  const tamperedB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString("base64url");
  const tamperedToken = `${tamperedB64}.${signature}`;

  assert.equal(verifyImpersonationToken(tamperedToken), null);
});

test("Admin Impersonation: rejects expired impersonation tokens", () => {
  const expiredPayload: ImpersonationPayload = {
    ...payload,
    startedAt: Date.now() - IMPERSONATION_TTL_MS - 1000,
    expiresAt: Date.now() - 1000,
  };
  const token = signImpersonationToken(expiredPayload);
  assert.equal(verifyImpersonationToken(token), null);
});
