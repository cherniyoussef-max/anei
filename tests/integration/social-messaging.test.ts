import test from "node:test";
import assert from "node:assert/strict";
import { getPrimaryOrganization } from "../../src/server/queries/organizations";
import {
  getOrCreateSocialAccountForOrg,
  getSocialConversations,
  getSocialConversationMessages,
} from "../../src/server/queries/social-messaging";
import {
  sendSocialTextMessageService,
  simulateSocialInboundMessage,
  ingestSocialWebhookEvents,
} from "../../src/server/services/social-messaging";
import { socialWebhookStableKey } from "../../src/server/social/normalize";

test("social messaging: auto-provisions Instagram and Messenger accounts", async () => {
  const org = await getPrimaryOrganization();
  assert.ok(org, "Primary organization must exist");

  const igAccount = await getOrCreateSocialAccountForOrg(org.id, "INSTAGRAM");
  assert.ok(igAccount);
  assert.equal(igAccount.channel, "INSTAGRAM");
  assert.equal(igAccount.status, "ACTIVE");

  const fbAccount = await getOrCreateSocialAccountForOrg(org.id, "MESSENGER");
  assert.ok(fbAccount);
  assert.equal(fbAccount.channel, "MESSENGER");
  assert.equal(fbAccount.status, "ACTIVE");
});

test("social messaging: inbound simulation and outbound dispatch cycle", async () => {
  const org = await getPrimaryOrganization();
  assert.ok(org);

  const testSenderId = `test_ig_user_${Date.now()}`;
  const testText = "Bonjour, test d'intégration Instagram ANEI";

  // 1. Simulate inbound message
  const inbound = await simulateSocialInboundMessage({
    organizationId: org.id,
    channel: "INSTAGRAM",
    senderId: testSenderId,
    senderName: "Nour Ben Salah",
    senderUsername: "nour_bensalah",
    text: testText,
  });

  assert.ok(inbound);
  assert.equal(inbound.channel, "INSTAGRAM");
  assert.equal(inbound.direction, "INBOUND");
  assert.equal(inbound.textPreview, testText);

  // 2. Query conversations
  const conversations = await getSocialConversations(org.id, "INSTAGRAM");
  const thread = conversations.find((c) => c.peerId === testSenderId);
  assert.ok(thread, "Thread must be discovered in conversations");
  assert.equal(thread.contactName, "Nour Ben Salah");
  assert.equal(thread.username, "nour_bensalah");
  assert.equal(thread.lastMessage?.text, testText);
  assert.ok(thread.unreadCount >= 1);

  // 3. Send outbound reply
  const outbound = await sendSocialTextMessageService({
    organizationId: org.id,
    channel: "INSTAGRAM",
    recipientId: testSenderId,
    text: "Bonjour Nour, nous vous remercions pour votre message !",
  });

  assert.ok(outbound);
  assert.equal(outbound.direction, "OUTBOUND");
  assert.equal(outbound.recipientId, testSenderId);

  // 4. Query messages in thread
  const messages = await getSocialConversationMessages(org.id, "INSTAGRAM", testSenderId);
  assert.ok(messages.length >= 2, "Thread must contain both inbound and outbound messages");
});

test("social messaging: webhook idempotency prevents duplicate ingestion", async () => {
  const org = await getPrimaryOrganization();
  assert.ok(org);

  const mid = `test_mid_dedup_${Date.now()}`;
  const stableKey = socialWebhookStableKey("MESSENGER", "message", mid);

  const events = [
    {
      kind: "inbound_message" as const,
      channel: "MESSENGER" as const,
      stableKey,
      providerMessageId: mid,
      senderId: "test_fb_user_1",
      recipientId: "page_aneiacademie",
      text: "Message avec clé stable",
      timestamp: new Date(),
      externalAccountId: "page_aneiacademie",
    },
  ];

  const firstRun = await ingestSocialWebhookEvents(events, org.id);
  assert.equal(firstRun.processed, 1);
  assert.equal(firstRun.duplicates, 0);

  // Replaying the exact same event must be counted as duplicate
  const secondRun = await ingestSocialWebhookEvents(events, org.id);
  assert.equal(secondRun.processed, 0);
  assert.equal(secondRun.duplicates, 1);
});

test.after(async () => {
  const { pool } = await import("../../src/server/db");
  await pool.end();
});
