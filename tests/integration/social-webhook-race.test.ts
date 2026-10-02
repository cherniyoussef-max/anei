import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/server/db";
import { socialMessage, socialWebhookEvent, organization } from "../../src/server/db/schema";
import { ingestSocialWebhookEvents } from "../../src/server/services/social-messaging";
import type { NormalizedSocialEvent } from "../../src/server/social/normalize";

test("Fix 3 TDD: Concurrent webhook ingestion race condition (TOCTOU)", async () => {
  // Ensure an organization exists
  let [org] = await db.select().from(organization).limit(1);
  if (!org) {
    [org] = await db.insert(organization).values({ name: "Test Org", slug: "test-org" }).returning();
  }

  const uniqueSuffix = crypto.randomBytes(6).toString("hex");
  const stableKey = `msg:test_mid_${uniqueSuffix}`;
  const providerMessageId = `test_mid_${uniqueSuffix}`;

  const event: NormalizedSocialEvent = {
    kind: "inbound_message",
    channel: "INSTAGRAM",
    stableKey,
    providerMessageId,
    externalAccountId: `ext_${uniqueSuffix}`,
    senderId: `sender_${uniqueSuffix}`,
    recipientId: `recipient_${uniqueSuffix}`,
    text: "Concurrent message test",
    timestamp: new Date(),
  };

  // Launch 5 concurrent ingestSocialWebhookEvents calls with the EXACT same event
  // BEFORE FIX: SELECT-then-INSERT TOCTOU causes duplicate key crash (error 23505)
  // AFTER FIX: Atomic onConflictDoNothing in transaction handles all safely without crash
  const results = await Promise.all(
    Array.from({ length: 5 }, () => ingestSocialWebhookEvents([event], org.id)),
  );

  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
  const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0);

  // Exactly ONE must succeed and the others must be counted as duplicates
  assert.equal(totalProcessed, 1, `Expected exactly 1 processed event, got ${totalProcessed}`);
  assert.equal(totalDuplicates, 4, `Expected exactly 4 duplicates, got ${totalDuplicates}`);

  // Query database directly to confirm exactly 1 event and 1 message exist
  const dbEvents = await db
    .select()
    .from(socialWebhookEvent)
    .where(eq(socialWebhookEvent.stableKey, stableKey));
  assert.equal(dbEvents.length, 1, `Expected exactly 1 db event, found ${dbEvents.length}`);

  const dbMessages = await db
    .select()
    .from(socialMessage)
    .where(
      and(
        eq(socialMessage.channel, "INSTAGRAM"),
        eq(socialMessage.providerMessageId, providerMessageId),
      ),
    );
  assert.equal(dbMessages.length, 1, `Expected exactly 1 db message, found ${dbMessages.length}`);
});
