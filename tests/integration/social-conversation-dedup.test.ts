import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { db } from "../../src/server/db";
import { organization, socialMessage } from "../../src/server/db/schema";
import { getSocialConversations } from "../../src/server/queries/social-messaging";

test("Fix 5 TDD: Identical timestamps must never produce duplicate conversations in getSocialConversations", async () => {
  const uniqueOrg = `org_dedup_${crypto.randomBytes(4).toString("hex")}`;
  const [org] = await db
    .insert(organization)
    .values({ name: "Dedup Test Org", slug: uniqueOrg })
    .returning();

  const peerId = `peer_${crypto.randomBytes(4).toString("hex")}`;
  const identicalTimestamp = new Date("2026-09-26T12:00:00.000Z");

  // Insert two messages for the same peerId with the EXACT same timestamp
  await db.insert(socialMessage).values([
    {
      organizationId: org.id,
      channel: "INSTAGRAM",
      direction: "INBOUND",
      status: "DELIVERED",
      senderId: peerId,
      recipientId: "account_123",
      textPreview: "Message 1 (first arrived)",
      createdAt: identicalTimestamp,
      deliveredAt: identicalTimestamp,
    },
    {
      organizationId: org.id,
      channel: "INSTAGRAM",
      direction: "INBOUND",
      status: "DELIVERED",
      senderId: peerId,
      recipientId: "account_123",
      textPreview: "Message 2 (second arrived)",
      createdAt: identicalTimestamp,
      deliveredAt: identicalTimestamp,
    },
  ]);

  const conversations = await getSocialConversations(org.id, "INSTAGRAM");

  // BEFORE FIX: Returns 2 rows for the same peerId due to created_at = last_activity join!
  // AFTER FIX: Must return EXACTLY 1 conversation row with rn = 1.
  assert.equal(
    conversations.length,
    1,
    `Expected exactly 1 conversation for peerId, but got ${conversations.length} (duplicate conversations bug!)`,
  );
  assert.equal(conversations[0]?.peerId, peerId);
  assert.equal(conversations[0]?.totalMessages, 2);
});
