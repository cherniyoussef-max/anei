/**
 * Learner self-registration -> CRM auto-provisioning -> WhatsApp welcome ->
 * AI auto-reply. Provider HTTP calls are stubbed via globalThis.fetch and the
 * LLM provider is swapped for TestLLMProvider; the DB exercises are real.
 *
 * NOTE: env must be set BEFORE any dynamic import so the whatsappConfigured /
 * whatsappAutoWelcomeConfigured / whatsappAiRepliesConfigured gates are
 * observed (same requirement as tests/integration/whatsapp.test.ts).
 */
process.env.ENABLE_WHATSAPP = "true";
process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token";
process.env.WHATSAPP_APP_SECRET = "test-app-secret";
process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-token";
process.env.ENABLE_WHATSAPP_AUTO_WELCOME = "true";
process.env.WHATSAPP_WELCOME_TEMPLATE_NAME = "anei_welcome";
process.env.ENABLE_WHATSAPP_AI_REPLIES = "true";
process.env.OPENAI_API_KEY = "test-openai-key";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import { drainOutboxForOrg } from "./helpers/outbox";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);

async function withClient(run: (client: Client) => Promise<void>) {
  if (!url) return;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

async function seedUser(client: Client, label = "onboard") {
  const userId = crypto.randomUUID();
  const email = `${label}-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test Learner', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return { userId, email };
}

function profilePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    firstName: "Amira",
    lastName: "Ben Salah",
    birthYear: 1995,
    phoneNumber: `+2165${Math.floor(1000000 + Math.random() * 8999999)}`,
    country: "Tunisie",
    governorate: "Tunis",
    city: "Tunis",
    preferredLocale: "fr",
    requestedPersona: "STUDENT",
    educationLevel: "Licence",
    institutionName: "N/A",
    termsAccepted: true,
    privacyAccepted: true,
    ...overrides,
  };
}

async function seedApprovedWelcomeTemplate(client: Client, orgId: string, phoneNumberId: string) {
  await client.query(
    `insert into whatsapp_account (id, organization_id, provider, phone_number_id, business_account_id, display_phone_number, status, created_at, updated_at)
     values (gen_random_uuid(), $1, 'meta', $2, 'waba-test', '+21600000000', 'ACTIVE', now(), now())`,
    [orgId, phoneNumberId],
  );
  await client.query(
    `insert into whatsapp_template (id, organization_id, name, language, category, status, parameter_count, created_at, updated_at)
     values (gen_random_uuid(), $1, 'anei_welcome', 'fr', 'UTILITY', 'APPROVED', 1, now(), now())`,
    [orgId],
  );
}

async function cleanupUserOnboarding(client: Client, orgId: string, userIds: string[]) {
  await client.query("delete from outbox_event where organization_id = $1", [orgId]);
  await client.query("delete from whatsapp_message where organization_id = $1", [orgId]);
  await client.query("delete from whatsapp_template where organization_id = $1", [orgId]);
  await client.query("delete from whatsapp_account where organization_id = $1", [orgId]);
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = $1 and linked_user_id = any($2))", [orgId, userIds]);
  await client.query("delete from crm_contact where organization_id = $1 and linked_user_id = any($2)", [orgId, userIds]);
  await client.query("delete from user_profile where user_id = any($1)", [userIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
  // The ANEI platform organization itself is a shared, permanent singleton —
  // never deleted by tests, matching production intent.
}

function providerSendOk(messageId: string) {
  return new Response(JSON.stringify({ messages: [{ id: messageId }] }), { status: 200, headers: { "content-type": "application/json" } });
}

test("ensureAneiPlatformOrganization: idempotent singleton across calls", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { ensureAneiPlatformOrganization } = await import("../../src/server/services/crm-onboarding");
    const first = await ensureAneiPlatformOrganization();
    const second = await ensureAneiPlatformOrganization();
    assert.equal(first, second);
    const rows = await client.query("select slug from organization where id = $1", [first]);
    assert.equal(rows.rows[0]?.slug, "anei-platform");
  });
});

test("provisionCrmContactForUser: creates once, updates (never duplicates) on re-call", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { db } = await import("../../src/server/db");
    const { ensureAneiPlatformOrganization, provisionCrmContactForUser } = await import("../../src/server/services/crm-onboarding");
    const { userId } = await seedUser(client, "provision");
    const orgId = await ensureAneiPlatformOrganization();

    try {
      const first = await provisionCrmContactForUser(db, userId, { firstName: "Amira", lastName: "Ben Salah", phone: "+21650000001" });
      const second = await provisionCrmContactForUser(db, userId, { firstName: "Amira", lastName: "Ben Salah (updated)", phone: "+21650000002" });
      assert.equal(first.contactId, second.contactId);

      const rows = await client.query("select last_name, phone from crm_contact where id = $1", [first.contactId]);
      assert.equal(rows.rows[0].last_name, "Ben Salah (updated)");
      assert.equal(rows.rows[0].phone, "+21650000002");

      const count = await client.query("select count(*)::int as n from crm_contact where organization_id = $1 and linked_user_id = $2", [orgId, userId]);
      assert.equal(count.rows[0].n, 1);
    } finally {
      await cleanupUserOnboarding(client, orgId, [userId]);
    }
  });
});

test("completeUserProfile: auto-provisions a CRM contact and, once configured, sends a welcome template", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { completeUserProfile } = await import("../../src/server/auth/profile");
    const { ensureAneiPlatformOrganization } = await import("../../src/server/services/crm-onboarding");
    const { userId } = await seedUser(client, "complete");
    const orgId = await ensureAneiPlatformOrganization();
    const phoneNumberId = `pni-${crypto.randomUUID()}`.slice(0, 40);

    try {
      await seedApprovedWelcomeTemplate(client, orgId, phoneNumberId);

      const payload = profilePayload();
      const result = await completeUserProfile(userId, payload);
      assert.equal(result.ok, true);

      const contactRows = await client.query(
        "select id, first_name, phone from crm_contact where organization_id = $1 and linked_user_id = $2",
        [orgId, userId],
      );
      assert.equal(contactRows.rowCount, 1);
      assert.equal(contactRows.rows[0].first_name, "Amira");
      assert.equal(contactRows.rows[0].phone, payload.phoneNumber);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => providerSendOk(`wamid.${crypto.randomUUID()}`)) as typeof fetch;
      try {
        await drainOutboxForOrg(orgId);
      } finally {
        globalThis.fetch = originalFetch;
      }

      const messageRows = await client.query(
        "select status, message_type, template_name, contact_id from whatsapp_message where organization_id = $1",
        [orgId],
      );
      assert.equal(messageRows.rowCount, 1);
      assert.equal(messageRows.rows[0].status, "SENT");
      assert.equal(messageRows.rows[0].message_type, "TEMPLATE");
      assert.equal(messageRows.rows[0].template_name, "anei_welcome");
      assert.equal(messageRows.rows[0].contact_id, contactRows.rows[0].id);

      // Re-completing the profile (an edit, not first completion) must not
      // send a second welcome message.
      const secondPayload = profilePayload({ city: "Sfax" });
      const secondResult = await completeUserProfile(userId, secondPayload);
      assert.equal(secondResult.ok, true);
      globalThis.fetch = (async () => providerSendOk(`wamid.${crypto.randomUUID()}`)) as typeof fetch;
      try {
        await drainOutboxForOrg(orgId);
      } finally {
        globalThis.fetch = originalFetch;
      }
      const recount = await client.query("select count(*)::int as n from whatsapp_message where organization_id = $1", [orgId]);
      assert.equal(recount.rows[0].n, 1);
    } finally {
      await cleanupUserOnboarding(client, orgId, [userId]);
    }
  });
});

test("whatsappAiReplyHandler: generates a bounded reply and sends it as free-form text", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { db } = await import("../../src/server/db");
    const { whatsappMessage } = await import("../../src/server/db/schema");
    const { ensureAneiPlatformOrganization, provisionCrmContactForUser } = await import("../../src/server/services/crm-onboarding");
    const { whatsappAiReplyHandler } = await import("../../src/server/queue/handlers/whatsapp-ai-reply");
    const { setLLMProvider, TestLLMProvider } = await import("../../src/server/ai/llm-provider");

    const { userId } = await seedUser(client, "aireply");
    const orgId = await ensureAneiPlatformOrganization();
    const phoneNumberId = `pni-${crypto.randomUUID()}`.slice(0, 40);

    try {
      const { contactId } = await provisionCrmContactForUser(db, userId, { firstName: "Sami", lastName: "Trabelsi", phone: "+21655000003" });
      await client.query(
        `insert into whatsapp_account (id, organization_id, provider, phone_number_id, business_account_id, display_phone_number, status, created_at, updated_at)
         values (gen_random_uuid(), $1, 'meta', $2, 'waba-test', '+21600000000', 'ACTIVE', now(), now())`,
        [orgId, phoneNumberId],
      );

      const [inbound] = await db
        .insert(whatsappMessage)
        .values({
          organizationId: orgId,
          contactId,
          direction: "INBOUND",
          messageType: "TEXT",
          status: "DELIVERED",
          fromPhone: "21655000003",
          textPreview: "chna7welek, 3andi mochkla fel inscription",
          deliveredAt: new Date(),
        })
        .returning({ id: whatsappMessage.id });

      const provider = new TestLLMProvider();
      provider.setDefaultResponse({ text: "Ahla! Ma t9al9ch, nchoufou flouk el mochkla mte3ek fel inscription.", usage: { inputTokens: 42, outputTokens: 17 } });
      setLLMProvider(provider);

      const event = { id: crypto.randomUUID(), organizationId: orgId } as Parameters<typeof whatsappAiReplyHandler.handle>[0];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => providerSendOk(`wamid.${crypto.randomUUID()}`)) as typeof fetch;
      let outcome;
      try {
        outcome = await whatsappAiReplyHandler.handle(event, { inboundMessageId: inbound.id });
      } finally {
        globalThis.fetch = originalFetch;
      }
      assert.equal(outcome.outcome, "SUCCEEDED");

      const replyRows = await client.query(
        "select status, message_type, text_preview, contact_id from whatsapp_message where organization_id = $1 and direction = 'OUTBOUND'",
        [orgId],
      );
      assert.equal(replyRows.rowCount, 1);
      assert.equal(replyRows.rows[0].status, "SENT");
      assert.equal(replyRows.rows[0].message_type, "TEXT");
      assert.equal(replyRows.rows[0].contact_id, contactId);
      assert.match(replyRows.rows[0].text_preview, /mochkla mte3ek fel inscription/);

      const activityRows = await client.query(
        "select type from crm_contact_activity where contact_id = $1 and type = 'WHATSAPP_AI_REPLY_SENT'",
        [contactId],
      );
      assert.equal(activityRows.rowCount, 1);
    } finally {
      await cleanupUserOnboarding(client, orgId, [userId]);
    }
  });
});
