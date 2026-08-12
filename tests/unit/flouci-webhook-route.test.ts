import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROUTE = "src/app/api/payments/flouci/webhook/route.ts";

test("body size is rejected before any parsing or rate-limit consumption", async () => {
  const source = await readFile(ROUTE, "utf8");
  const sizeCheckIndex = source.indexOf("declaredLength > 64 * 1024");
  const ipRateIndex = source.indexOf("consumeRateLimit(`flouci-webhook-ip:");
  const readBodyIndex = source.indexOf("readLimitedJson(request, 64 * 1024)");
  assert.ok(sizeCheckIndex > -1 && ipRateIndex > -1 && readBodyIndex > -1);
  assert.ok(sizeCheckIndex < ipRateIndex, "declared-length check must run before rate-limit consumption");
  assert.ok(ipRateIndex < readBodyIndex, "body is only read after the coarse IP rate limit passes");
  // The body reader itself is bounded, independent of the client-supplied header.
  assert.equal(source.includes("readLimitedJson(request, 64 * 1024)"), true);
});

test("payload is validated with a strict-length Zod schema before the payment id is trusted", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(source.includes("z.string().trim().min(1).max(128)"), true);
  assert.equal(source.includes("payloadSchema.safeParse(raw)"), true);
  const parseIndex = source.indexOf("payloadSchema.safeParse(raw)");
  const paymentIdIndex = source.indexOf("paymentIdFrom(parsed.data)");
  assert.ok(parseIndex > -1 && paymentIdIndex > -1 && parseIndex < paymentIdIndex);
});

test("a coarse per-IP limit and a separate bounded per-payment-id limit both run before provider verification", async () => {
  const source = await readFile(ROUTE, "utf8");
  const ipLimitIndex = source.indexOf("consumeRateLimit(`flouci-webhook-ip:${requestFingerprint(request)}`, 30, 60)");
  const paymentKeyIndex = source.indexOf("crypto.createHash(\"sha256\").update(paymentId).digest(\"hex\").slice(0, 32)");
  const paymentLimitIndex = source.indexOf("consumeRateLimit(`flouci-webhook-payment:${paymentKey}`, 5, 60)");
  const verifyIndex = source.indexOf("await verifyAndApplyByExternalId(");
  assert.ok(ipLimitIndex > -1 && paymentKeyIndex > -1 && paymentLimitIndex > -1 && verifyIndex > -1);
  assert.ok(ipLimitIndex < paymentKeyIndex, "IP limit must be checked first");
  assert.ok(paymentKeyIndex < paymentLimitIndex && paymentLimitIndex < verifyIndex, "payment-specific limit must gate provider verification");
  // The rate-limit key is a fixed-length hash of an already-bounded (<=128 char) identifier,
  // so attacker-controlled arbitrary ids cannot grow Redis key-space unboundedly.
  assert.equal(source.includes(".slice(0, 32)"), true);
});

test("an unknown payment reference is treated as non-retryable (404), not a transient server fault", async () => {
  const source = await readFile(ROUTE, "utf8");
  const notFoundIndex = source.indexOf('message === "PAYMENT_NOT_FOUND"');
  const status404Index = source.indexOf("status: 404");
  const status500Index = source.indexOf("status: 500");
  assert.ok(notFoundIndex > -1 && status404Index > -1 && status500Index > -1);
  assert.ok(notFoundIndex < status404Index && status404Index < status500Index, "PAYMENT_NOT_FOUND branch must return before the generic 500 branch");
  assert.equal(source.includes('logger.warn("payment.flouci_webhook_unknown_payment"'), true);
  assert.equal(source.includes('logger.error("payment.flouci_webhook_verification_failed"'), true);
});

test("logging on the failure paths carries only structured identifiers, never raw error objects, headers, or secrets", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(/logger\.error\("payment\.flouci_webhook_verification_failed",\s*\{\s*paymentKey,\s*error:\s*message\s*\}\)/.test(source), true);
  assert.equal(source.includes("request.headers.get(\"authorization\")"), false);
  assert.equal(source.includes("FLOUCI_PRIVATE_KEY"), false);
  assert.equal(source.includes("FLOUCI_PUBLIC_KEY"), false);
});

test("the webhook does not implement or invent a homemade signature/HMAC verification scheme", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(/createHmac|verifySignature|X-Flouci-Signature/i.test(source), false);
});

test("verifyAndApplyByExternalId is the sole authority for payment status; the raw payload is never used to decide paid/pending", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(source.includes("await verifyAndApplyByExternalId(\"flouci\", paymentId)"), true);
  // The parsed payload's own status/result fields are never read anywhere except to locate the payment id.
  assert.equal(source.includes("parsed.data.status"), false);
  assert.equal(source.includes(".result.status"), false);
});
