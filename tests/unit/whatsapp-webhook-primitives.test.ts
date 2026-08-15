import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyWebhookSignature, verifyWebhookChallenge, webhookStableKey } from "../../src/server/whatsapp/webhook";
import { normalizeWebhook } from "../../src/server/whatsapp/normalize";

function sign(body: string, secret: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

test("verifyWebhookSignature accepts a correct HMAC over the raw body and rejects tampering", () => {
  const secret = "s3cr3t-app-secret";
  const body = JSON.stringify({ object: "whatsapp_business_account" });
  const header = sign(body, secret);
  assert.equal(verifyWebhookSignature(Buffer.from(body, "utf8"), header, secret), true);

  assert.equal(verifyWebhookSignature(Buffer.from(`${body}x`, "utf8"), header, secret), false, "modified body must fail");
  assert.equal(verifyWebhookSignature(Buffer.from(body, "utf8"), "sha256=deadbeef", secret), false, "wrong digest must fail");
  assert.equal(verifyWebhookSignature(Buffer.from(body, "utf8"), null, secret), false, "missing header must fail");
  assert.equal(verifyWebhookSignature(Buffer.from(body, "utf8"), header, undefined), false, "missing app secret must fail");
});

test("verifyWebhookSignature is constant-time: wrong-length and right-length digests both fail closed", () => {
  const secret = "s3cr3t-app-secret";
  const body = "payload";
  assert.equal(verifyWebhookSignature(body, "sha256=", secret), false, "empty digest must fail");
  assert.equal(verifyWebhookSignature(body, `sha256=${"a".repeat(63)}`, secret), false, "short digest must fail");
  assert.equal(verifyWebhookSignature(body, `sha256=${"a".repeat(64)}`, secret), false, "right-length wrong digest must fail");
});

test("verifyWebhookChallenge: echoes only when mode=subscribe and token matches", () => {
  const params = { mode: "subscribe", verifyToken: "my-verify-token", challenge: "1854906098" };
  assert.equal(verifyWebhookChallenge(params, "my-verify-token"), true);
  assert.equal(verifyWebhookChallenge(params, "wrong-token"), false);
  assert.equal(verifyWebhookChallenge({ ...params, mode: "unsubscribe" }, "my-verify-token"), false);
  assert.equal(verifyWebhookChallenge({ ...params, challenge: null }, "my-verify-token"), false);
  assert.equal(verifyWebhookChallenge(params, null), false);
  assert.equal(verifyWebhookChallenge({ ...params, verifyToken: null }, "my-verify-token"), false);
});

test("webhookStableKey builds deterministic per-event idempotency keys", () => {
  assert.equal(webhookStableKey("message", "wamid.abc"), "message:wamid.abc");
  assert.equal(webhookStableKey("status", "wamid.abc", "delivered"), "status:wamid.abc:delivered");
  assert.equal(webhookStableKey("status", "wamid.abc", "delivered"), webhookStableKey("status", "wamid.abc", "delivered"));
});

test("normalizeWebhook: extracts inbound text messages and template flags", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "16505551111", phone_number_id: "112358132134" },
              contacts: [{ profile: { name: "Alex" }, wa_id: "15557777777" }],
              messages: [
                { from: "15557777777", id: "wamid.HBgLMTU1NTc3Nzc3Nzc3Nzc", timestamp: "1768472000", type: "text", text: { body: "Bonjour !" } },
                { from: "15557777777", id: "wamid.HBgLdGVtcGxhdGU", timestamp: "1768472001", type: "template", text: { body: "Réponse au modèle" } },
              ],
            },
          },
        ],
      },
    ],
  };

  const events = normalizeWebhook(payload);
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((e) => (e.kind === "inbound_message" ? { kind: e.kind, messageType: e.messageType, textPreview: e.textPreview } : { kind: e.kind })),
    [
      { kind: "inbound_message", messageType: "TEXT", textPreview: "Bonjour !" },
      { kind: "inbound_message", messageType: "TEMPLATE", textPreview: "Réponse au modèle" },
    ],
  );
});

test("normalizeWebhook: extracts status updates with terminal failure metadata", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "16505551111", phone_number_id: "112358132134" },
              statuses: [
                { id: "wamid.HBgLc2VudA", status: "sent", timestamp: "1768472000" },
                {
                  id: "wamid.HBgLZmFpbGVk",
                  status: "failed",
                  timestamp: "1768472050",
                  errors: [{ code: 131026, title: "Message undeliverable", message: "Message failed to deliver" }],
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const events = normalizeWebhook(payload);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, "status_update");
  assert.equal(events[1].kind, "status_update");
  assert.deepEqual(
    (events as Array<{ status: string }>).map((e) => e.status),
    ["SENT", "FAILED"],
  );
  const failed = events[1];
  assert.ok(failed.kind === "status_update");
  assert.equal(failed.providerErrorCode, "131026");
  assert.equal(failed.providerErrorMessage, "Message failed to deliver");
});

test("normalizeWebhook: unknown/changed-field entries are ignored, never passed through", () => {
  assert.deepEqual(normalizeWebhook({ object: "whatsapp_business_account", entry: [{ id: "x", changes: [{ field: "other", value: { messages: [{ id: "m1" }] } }] }] }), []);
  assert.deepEqual(normalizeWebhook({ object: "whatsapp_business_account" }), []);
  assert.deepEqual(normalizeWebhook({ entry: [{ id: "x", changes: [{ field: "messages", value: { messages: [{ id: "m1", from: "1" }] } }] }] }), [], "missing phone_number_id is not an event");
  assert.deepEqual(normalizeWebhook(null), []);
});

test("normalizeWebhook: over-bound identifiers are rejected fail-closed, text previews are truncated", () => {
  const longId = "w".repeat(300);
  const events = normalizeWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "112358132134" },
              messages: [{ from: "15557777777", id: longId, timestamp: "1768472000", type: "text", text: { body: "x".repeat(6000) } }],
            },
          },
        ],
      },
    ],
  });
  // An id beyond the hard 256-char bound fails schema validation, so the event is
  // rejected entirely (never stored) rather than truncated and trusted.
  assert.equal(events.length, 0);

  // A well-formed id with an over-long body is kept, with the preview truncated to 4096.
  const truncated = normalizeWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "112358132134" },
              messages: [{ from: "15557777777", id: "wamid.HBgL", timestamp: "1768472000", type: "text", text: { body: "x".repeat(6000) } }],
            },
          },
        ],
      },
    ],
  });
  assert.equal(truncated.length, 1);
  const event = truncated[0];
  assert.ok(event.kind === "inbound_message");
  assert.equal(event.textPreview, "x".repeat(4096));
});