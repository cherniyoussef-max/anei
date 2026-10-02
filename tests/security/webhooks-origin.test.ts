import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { parseAndVerifyMetaWebhook } from "@/server/whatsapp/webhook";

function createHmacSignature(body: string, secret: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

test("Item 4 Security: Webhooks are exempt from browser Origin checks and authenticated strictly via HMAC signature", async () => {
  const secret = "test-meta-webhook-app-secret-1234567890";
  const validPayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_test",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "21612345678", phone_number_id: "phone_123" },
              contacts: [{ profile: { name: "Test User" }, wa_id: "21612345678" }],
              messages: [{ from: "21612345678", id: "wamid.test1", timestamp: "1700000000", text: { body: "Hello" }, type: "text" }],
            },
            field: "messages",
          },
        ],
      },
    ],
  });
  const validSignature = createHmacSignature(validPayload, secret);

  // 1. Signed request from Meta with NO Origin header -> MUST SUCCEED (200)
  const reqNoOrigin = new Request("https://anei.tn/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": validSignature,
    },
    body: validPayload,
  });
  const resNoOrigin = await parseAndVerifyMetaWebhook(reqNoOrigin, { appSecret: secret });
  assert.equal(resNoOrigin.ok, true, "Signed webhook without Origin must succeed");

  // 2. Signed request from Meta with foreign Origin (e.g. Meta server or attacker domain) -> MUST SUCCEED
  const reqForeignOrigin = new Request("https://anei.tn/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://facebook.com",
      "x-hub-signature-256": validSignature,
    },
    body: validPayload,
  });
  const resForeignOrigin = await parseAndVerifyMetaWebhook(reqForeignOrigin, { appSecret: secret });
  assert.equal(resForeignOrigin.ok, true, "Signed webhook with foreign Origin must succeed");

  // 3. Unsigned request with NO Origin header -> MUST FAIL with 401
  const reqUnsignedNoOrigin = new Request("https://anei.tn/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: validPayload,
  });
  const resUnsignedNoOrigin = await parseAndVerifyMetaWebhook(reqUnsignedNoOrigin, { appSecret: secret });
  assert.equal(resUnsignedNoOrigin.ok, false);
  assert.equal(resUnsignedNoOrigin.status, 401);
  assert.equal(resUnsignedNoOrigin.error, "MISSING_SIGNATURE");

  // 4. Browser request with foreign Origin and NO signature -> MUST FAIL with 401
  const reqBrowserUnsigned = new Request("https://anei.tn/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://evil-attacker.example",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    body: validPayload,
  });
  const resBrowserUnsigned = await parseAndVerifyMetaWebhook(reqBrowserUnsigned, { appSecret: secret });
  assert.equal(resBrowserUnsigned.ok, false);
  assert.equal(resBrowserUnsigned.status, 401);
  assert.equal(resBrowserUnsigned.error, "MISSING_SIGNATURE");

  // 5. Tampered request with forged signature -> MUST FAIL with 401
  const reqTampered = new Request("https://anei.tn/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://evil-attacker.example",
      "x-hub-signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
    },
    body: validPayload,
  });
  const resTampered = await parseAndVerifyMetaWebhook(reqTampered, { appSecret: secret });
  assert.equal(resTampered.ok, false);
  assert.equal(resTampered.status, 401);
  assert.equal(resTampered.error, "INVALID_SIGNATURE");
});
