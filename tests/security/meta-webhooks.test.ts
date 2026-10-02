import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  parseAndVerifyMetaWebhook,
  MAX_META_WEBHOOK_BODY_BYTES,
} from "../../src/server/whatsapp/webhook";

function createHmacSignature(body: string, secret: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

test("Fix 2: verifyWebhookChallenge uses constant-time comparison and fails closed", () => {
  // Should reject unset/empty expected token
  assert.equal(
    verifyWebhookChallenge({ mode: "subscribe", verifyToken: "token", challenge: "123" }, undefined),
    false,
    "Undefined expected token must fail closed",
  );
  assert.equal(
    verifyWebhookChallenge({ mode: "subscribe", verifyToken: "token", challenge: "123" }, ""),
    false,
    "Empty expected token must fail closed",
  );
  assert.equal(
    verifyWebhookChallenge({ mode: "subscribe", verifyToken: null, challenge: "123" }, "token"),
    false,
    "Null received verify token must fail closed",
  );
  assert.equal(
    verifyWebhookChallenge({ mode: "unsubscribe", verifyToken: "token", challenge: "123" }, "token"),
    false,
    "Non-subscribe mode must fail closed",
  );
  assert.equal(
    verifyWebhookChallenge({ mode: "subscribe", verifyToken: "token", challenge: null }, "token"),
    false,
    "Null challenge must fail closed",
  );
  assert.equal(
    verifyWebhookChallenge({ mode: "subscribe", verifyToken: "correct-token", challenge: "123" }, "correct-token"),
    true,
    "Matching token must pass",
  );
  assert.equal(
    verifyWebhookChallenge({ mode: "subscribe", verifyToken: "wrong-token", challenge: "123" }, "correct-token"),
    false,
    "Mismatched token must fail closed",
  );
  // Different byte lengths must not throw RangeError and must fail closed
  assert.equal(
    verifyWebhookChallenge({ mode: "subscribe", verifyToken: "short", challenge: "123" }, "much-longer-token"),
    false,
    "Length mismatch must fail closed without throwing",
  );
});

test("Fix 2: verifyWebhookSignature handles byte length safety and prevents RangeError", () => {
  const secret = "test-secret";
  const body = "hello world";
  const validSig = createHmacSignature(body, secret);

  assert.equal(verifyWebhookSignature(body, validSig, secret), true);
  assert.equal(verifyWebhookSignature(body, "sha256=invalid", secret), false);
  assert.equal(verifyWebhookSignature(body, null, secret), false);
  assert.equal(verifyWebhookSignature(body, validSig, undefined), false);

  // Multi-byte or mismatched length strings must not throw RangeError
  assert.equal(verifyWebhookSignature(body, "sha256=ééé", secret), false);
  assert.equal(verifyWebhookSignature(body, "sha256=" + "a".repeat(100), secret), false);
});

test("Fix 2: parseAndVerifyMetaWebhook enforces complete fail-closed verification pipeline", async () => {
  const secret = "super-secret-key-123";
  const payload = JSON.stringify({ entry: [{ id: "test" }] });
  const validSignature = createHmacSignature(payload, secret);

  // 1. Missing secret -> 500 MISCONFIGURED
  const reqNoSecret = new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": validSignature },
    body: payload,
  });
  const resNoSecret = await parseAndVerifyMetaWebhook(reqNoSecret, { appSecret: undefined });
  assert.equal(resNoSecret.ok, false);
  assert.equal(resNoSecret.status, 500);
  assert.equal(resNoSecret.error, "MISCONFIGURED");

  // 2. Missing signature header -> 401 MISSING_SIGNATURE
  const reqNoSig = new Request("http://localhost/webhook", {
    method: "POST",
    headers: {},
    body: payload,
  });
  const resNoSig = await parseAndVerifyMetaWebhook(reqNoSig, { appSecret: secret });
  assert.equal(resNoSig.ok, false);
  assert.equal(resNoSig.status, 401);
  assert.equal(resNoSig.error, "MISSING_SIGNATURE");

  // 3. Invalid / tampered signature -> 401 INVALID_SIGNATURE
  const reqBadSig = new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": "sha256=deadbeef" },
    body: payload,
  });
  const resBadSig = await parseAndVerifyMetaWebhook(reqBadSig, { appSecret: secret });
  assert.equal(resBadSig.ok, false);
  assert.equal(resBadSig.status, 401);
  assert.equal(resBadSig.error, "INVALID_SIGNATURE");

  // 4. Tampered body with old signature -> 401 INVALID_SIGNATURE
  const reqTampered = new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": validSignature },
    body: payload + " ",
  });
  const resTampered = await parseAndVerifyMetaWebhook(reqTampered, { appSecret: secret });
  assert.equal(resTampered.ok, false);
  assert.equal(resTampered.status, 401);
  assert.equal(resTampered.error, "INVALID_SIGNATURE");

  // 5. Oversized body -> 413 PAYLOAD_TOO_LARGE
  const bigBody = "x".repeat(300 * 1024);
  const reqBig = new Request("http://localhost/webhook", {
    method: "POST",
    headers: {
      "content-length": String(bigBody.length),
      "x-hub-signature-256": createHmacSignature(bigBody, secret),
    },
    body: bigBody,
  });
  const resBig = await parseAndVerifyMetaWebhook(reqBig, { appSecret: secret, maxBytes: MAX_META_WEBHOOK_BODY_BYTES });
  assert.equal(resBig.ok, false);
  assert.equal(resBig.status, 413);
  assert.equal(resBig.error, "PAYLOAD_TOO_LARGE");

  // 6. Malformed JSON -> 400 MALFORMED_JSON
  const malformed = "{ this is not json }";
  const reqMalformed = new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": createHmacSignature(malformed, secret) },
    body: malformed,
  });
  const resMalformed = await parseAndVerifyMetaWebhook(reqMalformed, { appSecret: secret });
  assert.equal(resMalformed.ok, false);
  assert.equal(resMalformed.status, 400);
  assert.equal(resMalformed.error, "MALFORMED_JSON");

  // 7. Valid payload + signature -> ok: true
  const reqValid = new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": validSignature },
    body: payload,
  });
  const resValid = await parseAndVerifyMetaWebhook<{ entry: Array<{ id: string }> }>(reqValid, { appSecret: secret });
  assert.equal(resValid.ok, true);
  if (resValid.ok) {
    assert.deepEqual(resValid.parsed.entry[0].id, "test");
  }
});

test("Fix 2: Route handlers fail closed with 500 when secret is missing, never fail open (200)", async () => {
  const instagramRoute = await import("../../src/app/api/webhooks/instagram/route");
  const messengerRoute = await import("../../src/app/api/webhooks/messenger/route");
  const whatsappRoute = await import("../../src/app/api/webhooks/whatsapp/route");

  const payload = JSON.stringify({ object: "instagram", entry: [] });

  // Unsigned request without configured secret MUST return 500 (misconfigured), NEVER 200
  const reqInstagram = new Request("http://localhost:3000/api/webhooks/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  const resInstagram = await instagramRoute.POST(reqInstagram);
  assert.notEqual(resInstagram.status, 200, "Instagram webhook must not return 200 when unconfigured");
  assert.equal(resInstagram.status, 500, "Instagram webhook must return 500 when secret is unset");

  const reqMessenger = new Request("http://localhost:3000/api/webhooks/messenger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  const resMessenger = await messengerRoute.POST(reqMessenger);
  assert.notEqual(resMessenger.status, 200, "Messenger webhook must not return 200 when unconfigured");
  assert.equal(resMessenger.status, 500, "Messenger webhook must return 500 when secret is unset");

  const reqWhatsapp = new Request("http://localhost:3000/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  const resWhatsapp = await whatsappRoute.POST(reqWhatsapp);
  assert.notEqual(resWhatsapp.status, 200, "WhatsApp webhook must not return 200 when unconfigured");
  assert.equal(resWhatsapp.status, 500, "WhatsApp webhook must return 500 when secret is unset");
});

test("Fix 3: Staging environment without secret returns 500 and rejects unsigned bypass", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origDeploymentEnv = process.env.ANEI_DEPLOYMENT_ENV;
  const origAllowUnsigned = process.env.META_WEBHOOK_ALLOW_UNSIGNED;

  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      ANEI_DEPLOYMENT_ENV: "staging",
      META_WEBHOOK_ALLOW_UNSIGNED: "true",
    });

    const payload = JSON.stringify({ object: "page", entry: [] });
    const req = new Request("https://staging.anei.tn/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const res = await parseAndVerifyMetaWebhook(req, { appSecret: undefined });
    assert.equal(res.ok, false);
    assert.equal(res.status, 500, "Staging environment must return status 500 when secret is missing");
    assert.equal(res.error, "MISCONFIGURED");
  } finally {
    Object.assign(process.env, {
      NODE_ENV: origNodeEnv,
      ANEI_DEPLOYMENT_ENV: origDeploymentEnv,
      META_WEBHOOK_ALLOW_UNSIGNED: origAllowUnsigned,
    });
  }
});
