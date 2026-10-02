import test from "node:test";
import assert from "node:assert/strict";
import {
  sendSocialTextMessage,
  SocialProviderError,
} from "../../src/server/social/provider";

test("sendSocialTextMessage in mock/dev mode returns a valid mock ID and delivery status", async () => {
  // Without Meta env tokens set, it must safely fallback to mock mode
  const res = await sendSocialTextMessage({
    channel: "INSTAGRAM",
    recipientId: "ig_recipient_123",
    text: "Bonjour de l'académie ANEI",
  });

  assert.equal(res.isMock, true);
  assert.equal(res.recipientId, "ig_recipient_123");
  assert.ok(res.providerMessageId.startsWith("mock_meta_instagram_"));
});

test("sendSocialTextMessage handles Messenger channel in mock mode", async () => {
  const res = await sendSocialTextMessage({
    channel: "MESSENGER",
    recipientId: "psid_recipient_456",
    text: "Bonjour, votre inscription est validée.",
  });

  assert.equal(res.isMock, true);
  assert.equal(res.recipientId, "psid_recipient_456");
  assert.ok(res.providerMessageId.startsWith("mock_meta_messenger_"));
});

test("SocialProviderError preserves error code and status", () => {
  const err = new SocialProviderError("Invalid OAuth access token", "META_AUTH_ERROR", 401);
  assert.equal(err.message, "Invalid OAuth access token");
  assert.equal(err.code, "META_AUTH_ERROR");
  assert.equal(err.httpStatus, 401);
  assert.equal(err.name, "SocialProviderError");
});
