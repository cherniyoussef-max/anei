import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);

function trustedRequest(email: string, locale = "fr") {
  return new Request("http://localhost:3000/api/auth/verification/resend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({ email, locale }),
  });
}

test("resend route rejects untrusted origins", { skip: !url }, async () => {
  const { POST } = await import("../../src/app/api/auth/verification/resend/route");
  const request = new Request("http://localhost:3000/api/auth/verification/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ email: "someone@example.test", locale: "fr" }),
  });
  const response = await POST(request);
  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.equal(payload.error, "UNTRUSTED_ORIGIN");
});

test("resend route rejects invalid input (bad email, bad locale)", { skip: !url }, async () => {
  const { POST } = await import("../../src/app/api/auth/verification/resend/route");

  const badEmail = await POST(trustedRequest("not-an-email"));
  assert.equal(badEmail.status, 400);

  const badLocale = await POST(new Request("http://localhost:3000/api/auth/verification/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email: "someone@example.test", locale: "xx" }),
  }));
  assert.equal(badLocale.status, 400);
});

test("resend route enforces a server-side cooldown independent of the client", { skip: !url }, async () => {
  const { POST } = await import("../../src/app/api/auth/verification/resend/route");
  const { consumeRateLimit } = await import("../../src/server/security/rate-limit");
  const email = `resend-cooldown-${crypto.randomUUID()}@example.test`;

  // Simulate an immediately-preceding resend by pre-consuming the same
  // cooldown key the route itself uses - proves the limit is enforced
  // server-side (not merely disabled client-side), without depending on an
  // outbound SMTP call succeeding.
  await consumeRateLimit(`verify-email:resend:cooldown:${email}`, 1, 45);

  const response = await POST(trustedRequest(email));
  assert.equal(response.status, 429);
  const payload = await response.json();
  assert.equal(payload.error, "RESEND_COOLDOWN");
  assert.equal(typeof payload.retryAfterSeconds, "number");
});

test("resend route enforces a per-email hourly rate limit independent of the client", { skip: !url }, async () => {
  const { POST } = await import("../../src/app/api/auth/verification/resend/route");
  const { consumeRateLimit } = await import("../../src/server/security/rate-limit");
  const email = `resend-hourly-${crypto.randomUUID()}@example.test`;

  await consumeRateLimit(`verify-email:resend:email:${email}`, 5, 3600, { fallbackLimit: 5 });
  await consumeRateLimit(`verify-email:resend:email:${email}`, 5, 3600, { fallbackLimit: 5 });
  await consumeRateLimit(`verify-email:resend:email:${email}`, 5, 3600, { fallbackLimit: 5 });
  await consumeRateLimit(`verify-email:resend:email:${email}`, 5, 3600, { fallbackLimit: 5 });
  await consumeRateLimit(`verify-email:resend:email:${email}`, 5, 3600, { fallbackLimit: 5 });

  const response = await POST(trustedRequest(email));
  assert.equal(response.status, 429);
  const payload = await response.json();
  assert.equal(payload.error, "RATE_LIMITED");
});
