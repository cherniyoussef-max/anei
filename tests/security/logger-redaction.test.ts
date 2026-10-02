import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeLogPayload } from "@/server/security/logger";

test("logger-redaction: redacts sensitive keys from objects", () => {
  const input = {
    username: "john_doe",
    password: "SuperSecretPassword123!",
    api_key: "ak_live_1234567890",
    authorization: "Bearer some_jwt_token",
    sessionToken: "sess_abc123",
    cookie: "session=xyz",
    otpCode: "123456",
    meetingUrl: "https://meet.google.com/xyz-123-abc",
    meetingPasscode: "secret_pass_123",
    joinToken: "jwt_join_token_999",
    accessCode: "ACC-999-CODE",
    nested: {
      clientSecret: "top_secret_value",
      publicInfo: "safe_to_log",
    },
  };

  const sanitized = sanitizeLogPayload(input) as Record<string, unknown>;
  assert.equal(sanitized.username, "john_doe");
  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.api_key, "[REDACTED]");
  assert.equal(sanitized.authorization, "[REDACTED]");
  assert.equal(sanitized.sessionToken, "[REDACTED]");
  assert.equal(sanitized.cookie, "[REDACTED]");
  assert.equal(sanitized.otpCode, "[REDACTED]");
  assert.equal(sanitized.meetingUrl, "[REDACTED]");
  assert.equal(sanitized.meetingPasscode, "[REDACTED]");
  assert.equal(sanitized.joinToken, "[REDACTED]");
  assert.equal(sanitized.accessCode, "[REDACTED]");

  const nested = sanitized.nested as Record<string, unknown>;
  assert.equal(nested.clientSecret, "[REDACTED]");
  assert.equal(nested.publicInfo, "safe_to_log");
});

test("logger-redaction: redacts query parameters containing secrets from string values", () => {
  const urlWithToken = "https://anei.tn/api/verify?token=secretToken123&locale=fr";
  const sanitized = sanitizeLogPayload(urlWithToken);
  assert.equal(sanitized, "https://anei.tn/api/verify?token=[REDACTED]&locale=fr");

  const urlWithCode = "https://anei.tn/api/auth/callback?code=superSecretCode456&state=safe";
  const sanitizedCode = sanitizeLogPayload(urlWithCode);
  assert.equal(sanitizedCode, "https://anei.tn/api/auth/callback?code=[REDACTED]&state=safe");
});

test("logger-redaction: redacts Bearer tokens in headers or string messages", () => {
  const headerVal = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M";
  const sanitized = sanitizeLogPayload(headerVal);
  assert.equal(sanitized, "Bearer [REDACTED]");

  const logMessage = "Request failed for Bearer dXNlcjpwYXNz at endpoint";
  const sanitizedMsg = sanitizeLogPayload(logMessage);
  assert.equal(sanitizedMsg, "Request failed for Bearer [REDACTED] at endpoint");
});

test("logger-redaction: sanitizes Error instances without leaking sensitive tokens in message or stack", () => {
  const err = new Error("Failed to connect to provider with token=ultraSecretPass");
  const sanitized = sanitizeLogPayload(err) as { name: string; message: string; stack?: string };
  assert.equal(sanitized.name, "Error");
  assert.equal(sanitized.message, "Failed to connect to provider with token=[REDACTED]");
  if (sanitized.stack) {
    assert.equal(sanitized.stack.includes("ultraSecretPass"), false);
  }
});
