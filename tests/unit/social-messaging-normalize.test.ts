import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSocialWebhook,
  socialWebhookStableKey,
} from "../../src/server/social/normalize";

test("socialWebhookStableKey builds deterministic per-event keys", () => {
  assert.equal(
    socialWebhookStableKey("INSTAGRAM", "message", "mid_12345"),
    "social:instagram:message:mid_12345",
  );
  assert.equal(
    socialWebhookStableKey("MESSENGER", "status", "mid_12345", "DELIVERED"),
    "social:messenger:status:mid_12345:DELIVERED",
  );
});

test("normalizeSocialWebhook parses Instagram inbound messages correctly", () => {
  const payload = {
    object: "instagram",
    entry: [
      {
        id: "ig_business_123",
        time: 1718000000000,
        messaging: [
          {
            sender: { id: "ig_user_456" },
            recipient: { id: "ig_business_123" },
            timestamp: 1718000000000,
            message: {
              mid: "m_ig_msg_999",
              text: "Bonjour, je souhaite m'inscrire à la formation AVS.",
            },
          },
        ],
      },
    ],
  };

  const events = normalizeSocialWebhook(payload);
  assert.equal(events.length, 1);
  const ev = events[0];
  assert.equal(ev.kind, "inbound_message");
  if (ev.kind === "inbound_message") {
    assert.equal(ev.channel, "INSTAGRAM");
    assert.equal(ev.providerMessageId, "m_ig_msg_999");
    assert.equal(ev.senderId, "ig_user_456");
    assert.equal(ev.recipientId, "ig_business_123");
    assert.equal(ev.text, "Bonjour, je souhaite m'inscrire à la formation AVS.");
    assert.equal(ev.stableKey, "social:instagram:message:m_ig_msg_999");
  }
});

test("normalizeSocialWebhook parses Messenger inbound messages and media attachments", () => {
  const payload = {
    object: "page",
    entry: [
      {
        id: "page_123456",
        time: 1718000000000,
        messaging: [
          {
            sender: { id: "psid_789" },
            recipient: { id: "page_123456" },
            timestamp: 1718000000000,
            message: {
              mid: "m_fb_msg_888",
              text: "Voici mon justificatif",
              attachments: [
                {
                  type: "image",
                  payload: { url: "https://cdn.example.com/receipt.jpg" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const events = normalizeSocialWebhook(payload);
  assert.equal(events.length, 1);
  const ev = events[0];
  assert.equal(ev.kind, "inbound_message");
  if (ev.kind === "inbound_message") {
    assert.equal(ev.channel, "MESSENGER");
    assert.equal(ev.providerMessageId, "m_fb_msg_888");
    assert.equal(ev.senderId, "psid_789");
    assert.equal(ev.recipientId, "page_123456");
    assert.equal(ev.text, "Voici mon justificatif");
    assert.equal(ev.mediaType, "IMAGE");
    assert.equal(ev.mediaUrl, "https://cdn.example.com/receipt.jpg");
  }
});

test("normalizeSocialWebhook parses delivery and read status receipts", () => {
  const payload = {
    object: "page",
    entry: [
      {
        id: "page_123456",
        time: 1718000000000,
        messaging: [
          {
            sender: { id: "psid_789" },
            recipient: { id: "page_123456" },
            delivery: {
              mids: ["mid_delivered_1"],
              watermark: 1718000000000,
            },
          },
          {
            sender: { id: "psid_789" },
            recipient: { id: "page_123456" },
            read: {
              mids: ["mid_read_1"],
              watermark: 1718000000000,
            },
          },
        ],
      },
    ],
  };

  const events = normalizeSocialWebhook(payload);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, "status_update");
  if (events[0].kind === "status_update") {
    assert.equal(events[0].status, "DELIVERED");
    assert.equal(events[0].providerMessageId, "mid_delivered_1");
  }
  if (events[1].kind === "status_update") {
    assert.equal(events[1].status, "READ");
    assert.equal(events[1].providerMessageId, "mid_read_1");
  }
});

test("normalizeSocialWebhook ignores echoes and malformed payloads", () => {
  assert.deepEqual(normalizeSocialWebhook(null), []);
  assert.deepEqual(normalizeSocialWebhook({}), []);
  assert.deepEqual(normalizeSocialWebhook({ object: "page", entry: [] }), []);

  // Echoes must be ignored
  const echoPayload = {
    object: "page",
    entry: [
      {
        id: "page_123",
        messaging: [
          {
            sender: { id: "page_123" },
            recipient: { id: "psid_456" },
            message: { mid: "echo_1", is_echo: true, text: "Outgoing from page" },
          },
        ],
      },
    ],
  };
  assert.deepEqual(normalizeSocialWebhook(echoPayload), []);
});
