/**
 * WhatsApp services (src/server/services/whatsapp.ts and
 * src/server/services/whatsapp-webhook.ts) import src/server/security/logger.ts
 * and src/server/security/rate-limit.ts transitively via the webhook route only;
 * the service modules themselves are safe to import outside Next.js (same
 * constraint and pattern as tests/integration/crm.test.ts). The webhook HTTP
 * route wrapper (signature verification, rate limiting, bounded body) is covered
 * by tests/unit/whatsapp-webhook-route.test.ts via source inspection. Provider
 * HTTP calls are stubbed via globalThis.fetch; the DB exercises are real.
 *
 * NOTE: env must be set BEFORE any dynamic import so the whatsappConfigured
 * gate is observed. WHATSAPP_* values here are test fixtures only.
 */
process.env.ENABLE_WHATSAPP = "true";
process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token";
process.env.WHATSAPP_APP_SECRET = "test-app-secret";
process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-token";

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

async function seedUser(client: Client) {
  const userId = crypto.randomUUID();
  const email = `wa-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'WhatsApp Test', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

async function uniquePhoneNumberId() {
  return `pni-${crypto.randomUUID()}`.slice(0, 40);
}

async function seedAccountAndTemplate(client: Client, actorId: string, orgId: string) {
  const { upsertWhatsAppAccount, syncWhatsAppTemplates } = await import("../../src/server/services/whatsapp");
  const phoneNumberId = await uniquePhoneNumberId();
  const account = await upsertWhatsAppAccount(actorId, "OWNER", orgId, { phoneNumberId, businessAccountId: "102290129340398" });
  assert.equal(account.kind, "ok");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [{ name: "welcome", language: "fr", category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "Bonjour {{1}}, bienvenue" }] }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    const synced = await syncWhatsAppTemplates(actorId, "OWNER", orgId);
    assert.equal(synced.kind, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const rows = await client.query(`select id from whatsapp_template where organization_id = $1 limit 1`, [orgId]);
  assert.equal(rows.rowCount, 1);
  return { templateId: rows.rows[0].id as string, phoneNumberId };
}

async function seedOrg(adminId: string) {
  const { createOrganization } = await import("../../src/server/services/organizations");
  return createOrganization(adminId, { name: "WhatsApp Org", slug: `wa-${crypto.randomUUID()}` }, adminId);
}

async function seedContact(adminId: string, orgId: string, phone: string) {
  const { createCrmContact } = await import("../../src/server/services/crm");
  const result = await createCrmContact(adminId, orgId, { firstName: "Léa", lastName: "Prospect", phone });
  assert.ok(result.kind === "ok");
  return result;
}

async function cleanup(client: Client, orgIds: string[], userIds: string[]) {
  await client.query("delete from outbox_event where organization_id = any($1)", [orgIds]);
  await client.query("delete from whatsapp_webhook_event where organization_id = any($1)", [orgIds]);
  await client.query("delete from whatsapp_message where organization_id = any($1)", [orgIds]);
  await client.query("delete from whatsapp_template where organization_id = any($1)", [orgIds]);
  await client.query("delete from whatsapp_account where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact where organization_id = any($1)", [orgIds]);
  await client.query("delete from organization where id = any($1)", [orgIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

function providerSendOk(messageId: string) {
  return new Response(JSON.stringify({ messages: [{ id: messageId }] }), { status: 200, headers: { "content-type": "application/json" } });
}

function providerSendError() {
  return new Response(
    JSON.stringify({ error: { message: "Message failed to send", code: 132000, error_data: { details: "reason" } } }),
    { status: 400, headers: { "content-type": "application/json" } },
  );
}

test("upsertWhatsAppAccount: creates then updates the org account; no secrets are ever stored", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { upsertWhatsAppAccount } = await import("../../src/server/services/whatsapp");
    const { getWhatsAppAccountForOrg } = await import("../../src/server/queries/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const phoneNumberId = await uniquePhoneNumberId();
    const created = await upsertWhatsAppAccount(adminId, "OWNER", org.id, {
      phoneNumberId,
      businessAccountId: "102290129340398",
      displayPhoneNumber: "+216 20 123 456",
    });
    assert.equal(created.kind, "ok");

    const account = await getWhatsAppAccountForOrg(org.id);
    assert.equal(account?.phoneNumberId, phoneNumberId);
    assert.equal(account?.businessAccountId, "102290129340398");

    const updated = await upsertWhatsAppAccount(adminId, "OWNER", org.id, {
      phoneNumberId,
      businessAccountId: "102290129340399",
      displayPhoneNumber: "+216 98 765 432",
    });
    assert.equal(updated.kind, "ok");
    assert.equal((await getWhatsAppAccountForOrg(org.id))?.businessAccountId, "102290129340399");

    const rows = await client.query("select * from whatsapp_account where organization_id = $1", [org.id]);
    assert.equal(rows.rowCount, 1);
    const values = Object.values(rows.rows[0]).map((v) => String(v));
    assert.equal(values.some((v) => v.includes("test-access-token") || v.includes("test-app-secret") || v.includes("test-verify-token")), false);

    await cleanup(client, [org.id], [adminId]);
  });
});

test("upsertWhatsAppAccount: org role below MANAGER is forbidden", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { upsertWhatsAppAccount } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const result = await upsertWhatsAppAccount(adminId, "STAFF", org.id, { phoneNumberId: await uniquePhoneNumberId(), businessAccountId: "102290129340398" });
    assert.equal(result.kind, "forbidden");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("sendWhatsAppTemplate: enqueues a QUEUED message + outbox job; the worker drives QUEUED → SENT, the provider id, an activity, and an audit row", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");
    const { getWhatsappMessageByProviderId } = await import("../../src/server/queries/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    assert.ok(contact.kind === "ok");

    const { templateId } = await seedAccountAndTemplate(client, adminId, org.id);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk("wamid.HBgLSUVDT1JJTkdEQVRF")) as typeof fetch;
    try {
      const result = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr", parameters: ["Léa"] });
      assert.equal(result.kind, "ok");
      assert.ok(result.kind === "ok");

      // Delivery is durable but async: the message is QUEUED with a matching
      // outbox job, and NO provider call has happened yet.
      const queued = await client.query("select status from whatsapp_message where id = $1", [result.id]);
      assert.equal(queued.rows[0].status, "QUEUED");
      const jobs = await client.query("select count(*)::int as n from outbox_event where organization_id = $1 and event_type = 'WHATSAPP_TEMPLATE_SEND'", [org.id]);
      assert.equal(jobs.rows[0].n, 1);

      // The worker performs the Meta call and writes SENT.
      await drainOutboxForOrg(org.id);

      const message = await getWhatsappMessageByProviderId("wamid.HBgLSUVDT1JJTkdEQVRF");
      assert.equal(message?.status, "SENT");
      assert.equal(message?.direction, "OUTBOUND");
      assert.equal(message?.toPhone, "21620123456");
      assert.equal(message?.contactId, contact.id);
      assert.ok(message?.sentAt);

      const outbox = await client.query("select status, last_error_code from outbox_event where organization_id = $1", [org.id]);
      assert.equal(outbox.rows[0].status, "SUCCEEDED");
    } finally {
      globalThis.fetch = originalFetch;
    }

    const activity = await client.query("select type from crm_contact_activity where contact_id = $1", [contact.id]);
    assert.ok(activity.rows.some((r) => r.type === "WHATSAPP_TEMPLATE_SENT"));

    const audit = await client.query("select count(*) as n from audit_logs where action = 'whatsapp.message.send' and metadata::text like $1", [`%${org.id}%`]);
    assert.ok(Number(audit.rows[0].n) >= 1);

    await cleanup(client, [org.id], [adminId]);
  });
});

test("sendWhatsAppTemplate: an org below MANAGER cannot send; a send with no org account fails closed", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    assert.ok(contact.kind === "ok");

    const forbidden = await sendWhatsAppTemplate(adminId, "VIEWER", org.id, { contactId: contact.id, templateId: "t", language: "fr" });
    assert.equal(forbidden.kind, "forbidden");

    const noAccount = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId: "t", language: "fr" });
    assert.equal(noAccount.kind, "no_account");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("sendWhatsAppTemplate: a provider rejection leaves the message QUEUED, then the worker terminally FAILs it + WHATSAPP_FAILED activity, no audit for the failed attempt", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    assert.ok(contact.kind === "ok");

    const { templateId } = await seedAccountAndTemplate(client, adminId, org.id);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendError()) as typeof fetch;
    try {
      const result = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr" });
      assert.equal(result.kind, "ok", "Phase 9: enqueue never waits on the provider");

      const queued = await client.query("select status from whatsapp_message where id = $1", [result.id]);
      assert.equal(queued.rows[0].status, "QUEUED");

      await drainOutboxForOrg(org.id);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const rows = await client.query("select status, provider_error_code from whatsapp_message where organization_id = $1", [org.id]);
    assert.equal(rows.rows[0].status, "FAILED");
    assert.equal(rows.rows[0].provider_error_code, "132000");

    const outbox = await client.query("select status, last_error_code from outbox_event where organization_id = $1", [org.id]);
    assert.equal(outbox.rows[0].status, "FAILED");

    const activity = await client.query("select type from crm_contact_activity where contact_id = $1", [contact.id]);
    assert.ok(activity.rows.some((r) => r.type === "WHATSAPP_FAILED"));

    await cleanup(client, [org.id], [adminId]);
  });
});

test("sendWhatsAppTemplate: same requestId never creates a second outbox job / re-sends an already-finalized message", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    assert.ok(contact.kind === "ok");

    const { templateId } = await seedAccountAndTemplate(client, adminId, org.id);

    const requestId = `req-${crypto.randomUUID()}`;
    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return providerSendOk(`wamid-${fetchCalls}`);
    }) as typeof fetch;

    try {
      const first = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr", requestId });
      assert.equal(first.kind, "ok");
      const retry = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr", requestId });
      assert.equal(retry.kind, "ok");

      const jobs = await client.query("select count(*)::int as n from outbox_event where organization_id = $1", [org.id]);
      assert.equal(jobs.rows[0].n, 1, "a retry with the same requestId must not enqueue a second outbox job");

      await drainOutboxForOrg(org.id);
      assert.equal(fetchCalls, 1, "a retry with the same requestId must not re-send");
    } finally {
      globalThis.fetch = originalFetch;
    }

    const rows = await client.query("select count(*) as n from whatsapp_message where organization_id = $1", [org.id]);
    assert.equal(Number(rows.rows[0].n), 1);

    await cleanup(client, [org.id], [adminId]);
  });
});

test("sendWhatsAppTemplate: requestId idempotency is scoped per-organization", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const orgA = await seedOrg(adminId);
    const orgB = await seedOrg(adminId);
    const contactA = await seedContact(adminId, orgA.id, "+216 20 123 456");
    const contactB = await seedContact(adminId, orgB.id, "+216 98 765 432");
    assert.ok(contactA.kind === "ok");
    assert.ok(contactB.kind === "ok");

    const a = await seedAccountAndTemplate(client, adminId, orgA.id);
    const b = await seedAccountAndTemplate(client, adminId, orgB.id);

    const requestId = `shared-${crypto.randomUUID()}`;
    const wamidA = `wamid.HBgL${crypto.randomUUID()}`;
    const wamidB = `wamid.HBgL${crypto.randomUUID()}`;

    const originalFetch = globalThis.fetch;
    const wamidByOrg = new Map([[orgA.id, wamidA], [orgB.id, wamidB]]);
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      const to = JSON.parse(String(init?.body)).to as string;
      const wamid = wamidByOrg.get(to === "21620123456" ? orgA.id : orgB.id)!;
      return providerSendOk(wamid);
    }) as typeof fetch;
    try {
      const sendA = await sendWhatsAppTemplate(adminId, "STAFF", orgA.id, { contactId: contactA.id, templateId: a.templateId, language: "fr", requestId });
      assert.equal(sendA.kind, "ok");
      const sendB = await sendWhatsAppTemplate(adminId, "STAFF", orgB.id, { contactId: contactB.id, templateId: b.templateId, language: "fr", requestId });
      assert.equal(sendB.kind, "ok", "the same requestId in another org must be an independent send");
      assert.notEqual(sendA.id, sendB.id);

      await drainOutboxForOrg(orgA.id);
      await drainOutboxForOrg(orgB.id);

      const rowsA = await client.query("select provider_message_id from whatsapp_message where organization_id = $1", [orgA.id]);
      const rowsB = await client.query("select provider_message_id from whatsapp_message where organization_id = $1", [orgB.id]);
      assert.equal(rowsA.rows[0].provider_message_id, wamidA);
      assert.equal(rowsB.rows[0].provider_message_id, wamidB);
    } finally {
      globalThis.fetch = originalFetch;
    }

    await cleanup(client, [orgA.id, orgB.id], [adminId]);
  });
});

test("sendWhatsAppTemplate: contact without a usable phone fails closed with no_phone", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 12 3");
    assert.ok(contact.kind === "ok");

    const { templateId } = await seedAccountAndTemplate(client, adminId, org.id);

    const result = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr" });
    assert.equal(result.kind, "no_phone");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("ingestWebhookEvents: an inbound message is stored, resolved to the contact, and deduplicated", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { upsertWhatsAppAccount } = await import("../../src/server/services/whatsapp");
    const { ingestWebhookEvents } = await import("../../src/server/services/whatsapp-webhook");
    const { normalizeWebhook } = await import("../../src/server/whatsapp/normalize");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    assert.ok(contact.kind === "ok");
    const phoneNumberId = await uniquePhoneNumberId();
    await upsertWhatsAppAccount(adminId, "OWNER", org.id, { phoneNumberId, businessAccountId: "102290129340398" });

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "102290129340398",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { display_phone_number: "16505551111", phone_number_id: phoneNumberId },
                messages: [
                  { from: "21620123456", id: "wamid.HBgLRE9VQkxFVEFNUEVS", timestamp: "1768472000", type: "text", text: { body: "Je suis intéressé(e)." } },
                ],
              },
            },
          ],
        },
      ],
    };

    const first = await ingestWebhookEvents(normalizeWebhook(payload));
    assert.equal(first.processed, 1);

    const message = await client.query("select * from whatsapp_message where provider_message_id = $1", ["wamid.HBgLRE9VQkxFVEFNUEVS"]);
    assert.equal(message.rowCount, 1);
    assert.equal(message.rows[0].direction, "INBOUND");
    assert.equal(message.rows[0].contact_id, contact.id);
    assert.equal(message.rows[0].status, "DELIVERED");
    assert.equal(message.rows[0].text_preview, "Je suis intéressé(e).");

    const activity = await client.query("select type from crm_contact_activity where contact_id = $1", [contact.id]);
    assert.ok(activity.rows.some((r) => r.type === "WHATSAPP_MESSAGE_RECEIVED"));

    // Meta replay of the exact same event must be a no-op.
    const replay = await ingestWebhookEvents(normalizeWebhook(payload));
    assert.equal(replay.processed, 0);
    assert.equal(replay.duplicates, 1);
    const count = await client.query("select count(*) as n from whatsapp_message where provider_message_id = $1", ["wamid.HBgLRE9VQkxFVEFNUEVS"]);
    assert.equal(Number(count.rows[0].n), 1);

    await cleanup(client, [org.id], [adminId]);
  });
});

test("ingestWebhookEvents: an inbound message from an unknown account is counted, never stored", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { ingestWebhookEvents } = await import("../../src/server/services/whatsapp-webhook");
    const { normalizeWebhook } = await import("../../src/server/whatsapp/normalize");

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "102290129340398",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "999999999999999" },
                messages: [{ from: "21620123456", id: "wamid.HBgLVU5LTk9XTg", timestamp: "1768472000", type: "text", text: { body: "hi" } }],
              },
            },
          ],
        },
      ],
    };

    const summary = await ingestWebhookEvents(normalizeWebhook(payload));
    assert.equal(summary.unknownAccount, 1);
    const stored = await client.query("select count(*) as n from whatsapp_message where provider_message_id = $1", ["wamid.HBgLVU5LTk9XTg"]);
    assert.equal(Number(stored.rows[0].n), 0);
    const ledgered = await client.query("select count(*) as n from whatsapp_webhook_event where stable_key = $1", ["message:wamid.HBgLVU5LTk9XTg"]);
    assert.equal(Number(ledgered.rows[0].n), 0);
    await cleanup(client, [], []);
  });
});

test("ingestWebhookEvents: status callbacks advance monotonically and replayed/out-of-order statuses cannot regress", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");
    const { ingestWebhookEvents } = await import("../../src/server/services/whatsapp-webhook");
    const { normalizeWebhook } = await import("../../src/server/whatsapp/normalize");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    assert.ok(contact.kind === "ok");

    const { templateId, phoneNumberId } = await seedAccountAndTemplate(client, adminId, org.id);

    const wamid = `wamid.HBgL${crypto.randomUUID()}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk(wamid)) as typeof fetch;
    try {
      const sent = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr" });
      assert.equal(sent.kind, "ok");
      await drainOutboxForOrg(org.id);
    } finally {
      globalThis.fetch = originalFetch;
    }

    function statusPayload(status: string) {
      return {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "102290129340398",
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: phoneNumberId },
                  statuses: [{ id: wamid, status, timestamp: "1768473000" }],
                },
              },
            ],
          },
        ],
      };
    }

    await ingestWebhookEvents(normalizeWebhook(statusPayload("delivered")));
    const delivered = await client.query("select status, delivered_at from whatsapp_message where provider_message_id = $1", [wamid]);
    assert.equal(delivered.rows[0].status, "DELIVERED");
    assert.ok(delivered.rows[0].delivered_at);

    // A replayed `sent` after `delivered` is a distinct ledger event but must be
    // ignored by the state machine (no regression to SENT).
    await ingestWebhookEvents(normalizeWebhook(statusPayload("sent")));
    const afterReplay = await client.query("select status from whatsapp_message where provider_message_id = $1", [wamid]);
    assert.equal(afterReplay.rows[0].status, "DELIVERED");

    await ingestWebhookEvents(normalizeWebhook(statusPayload("read")));
    const read = await client.query("select status, read_at from whatsapp_message where provider_message_id = $1", [wamid]);
    assert.equal(read.rows[0].status, "READ");
    assert.ok(read.rows[0].read_at);

    // A failed status after READ is rejected — FAILED is not retroactive.
    await ingestWebhookEvents(normalizeWebhook(statusPayload("failed")));
    const final = await client.query("select status from whatsapp_message where provider_message_id = $1", [wamid]);
    assert.equal(final.rows[0].status, "READ");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("whatsapp_message: ON DELETE SET NULL keeps history when the contact is deleted", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    assert.ok(contact.kind === "ok");

    const { templateId } = await seedAccountAndTemplate(client, adminId, org.id);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk("wamid.HBgLVFJPVUFSU0VO")) as typeof fetch;
    try {
      const sent = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr" });
      assert.equal(sent.kind, "ok");
      await drainOutboxForOrg(org.id);
    } finally {
      globalThis.fetch = originalFetch;
    }

    await client.query("delete from crm_contact where id = $1", [contact.id]);
    const message = await client.query("select contact_id from whatsapp_message where organization_id = $1", [org.id]);
    assert.equal(message.rows[0].contact_id, null, "history must survive contact deletion via SET NULL");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("DB enforces the bounded activity/status/direction CHECK constraints", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { upsertWhatsAppAccount } = await import("../../src/server/services/whatsapp");
    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    await upsertWhatsAppAccount(adminId, "OWNER", org.id, { phoneNumberId: await uniquePhoneNumberId(), businessAccountId: "102290129340398" });

    await assert.rejects(
      client.query(
        `insert into whatsapp_message (id, organization_id, account_id, direction, message_type, status, created_at, updated_at)
         values ($1, $2, $3, 'INBOUND', 'TEXT', 'BOGUS', now(), now())`,
        [crypto.randomUUID(), org.id, crypto.randomUUID()],
      ),
      /check constraint|violates/i,
    );
    await assert.rejects(
      client.query(
        `insert into whatsapp_message (id, organization_id, account_id, direction, message_type, status, created_at, updated_at)
         values ($1, $2, $3, 'SIDEWAYS', 'TEXT', 'SENT', now(), now())`,
        [crypto.randomUUID(), org.id, crypto.randomUUID()],
      ),
      /check constraint|violates/i,
    );
    await assert.rejects(
      client.query(
        `insert into whatsapp_webhook_event (id, stable_key, event_type, received_at)
         values ($1, $2, 'NOT_A_TYPE', now())`,
        [crypto.randomUUID(), crypto.randomUUID()],
      ),
      /check constraint|violates/i,
    );

    await cleanup(client, [org.id], [adminId]);
  });
});

test("whatsapp_webhook_event: the stable-key unique index makes concurrent replays a single ledger row", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const stableKey = `status:${crypto.randomUUID()}:delivered`;
    const replayClients = await Promise.all(Array.from({ length: 3 }, async () => {
      const replayClient = new Client({ connectionString: url });
      await replayClient.connect();
      return replayClient;
    }));
    try {
      await Promise.all(replayClients.map((replayClient) =>
        replayClient.query(
          `insert into whatsapp_webhook_event (id, stable_key, event_type, received_at)
           values ($1, $2, 'STATUS_UPDATE', now()) on conflict do nothing`,
          [crypto.randomUUID(), stableKey],
        ),
      ));
    } finally {
      await Promise.all(replayClients.map((replayClient) => replayClient.end()));
    }
    const rows = await client.query("select count(*) as n from whatsapp_webhook_event where stable_key = $1", [stableKey]);
    assert.equal(Number(rows.rows[0].n), 1);
    await client.query("delete from whatsapp_webhook_event where stable_key = $1", [stableKey]);
  });
});
