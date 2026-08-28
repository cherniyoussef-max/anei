import test from "node:test";
import assert from "node:assert/strict";
import { categorizeMailError } from "../../src/server/services/mailer";

test("categorizeMailError recognizes Brevo unauthorized-IP rejection", () => {
  assert.equal(categorizeMailError({ responseCode: 525, response: "unauthorized IP" }), "UNAUTHORIZED_IP");
});

test("categorizeMailError recognizes SMTP auth failure", () => {
  assert.equal(categorizeMailError({ code: "EAUTH" }), "AUTH_FAILED");
});

test("categorizeMailError recognizes connection/timeout/DNS failures", () => {
  assert.equal(categorizeMailError({ code: "ECONNREFUSED" }), "CONNECTION_REFUSED");
  assert.equal(categorizeMailError({ code: "ETIMEDOUT" }), "TIMEOUT");
  assert.equal(categorizeMailError({ code: "ENOTFOUND" }), "DNS_ERROR");
});

test("categorizeMailError falls back to UNKNOWN for unrecognized errors", () => {
  assert.equal(categorizeMailError(new Error("something else")), "UNKNOWN");
  assert.equal(categorizeMailError(null), "UNKNOWN");
});
