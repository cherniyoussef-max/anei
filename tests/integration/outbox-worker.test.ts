/**
 * Phase 9 outbox worker engine (src/server/queue/worker-engine.ts +
 * handlers/) integration tests. Same fixture pattern as
 * tests/integration/whatsapp.test.ts: real DB, Meta HTTP stubbed via
 * globalThis.fetch. All cycles are scoped by organizationId (see
 * helpers/outbox.ts) so concurrent integration test files never interfere.
 * These tests exercise the worker DIRECTLY (claim → process → write-back),
 * including lease recovery and retry/exhaustion paths.
 */
process.env.ENABLE_WHATSAPP = "true";
process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token";
process.env.WHATSAPP_APP_SECRET = "test-app-secret";
process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-token";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";

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
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Outbox Test', $2, true, 'USER', 'learner', now(), now())`,
    [userId, `ox-${userId}@example.test`],
  );
  return userId;
}

async function seedOrg(adminId: string) {
  const { createOrganization } = await import("../../src/server/services/organizations");
  return createOrganization(adminId, { name: "Outbox Org", slug: `ox-${crypto.randomUUID()}` }, adminId);
}

async function seedContact(adminId: string, orgId: string, phone: string) {
  const { createCrmContact } = await import("../../src/server/services/crm");
  const result = await createCrmContact(adminId, orgId, { firstName: "O", lastName: "Prospect", phone });
  assert.ok(result.kind === "ok");
  return result;
}

async function seedAccountAndTemplate(client: Client, actorId: string, orgId: string) {
  const { upsertWhatsAppAccount, syncWhatsAppTemplates } = await import("../../src/server/services/whatsapp");
  const phoneNumberId = `pni-${crypto.randomUUID()}`.slice(0, 40);
  const account = await upsertWhatsAppAccount(actorId, "OWNER", orgId, { phoneNumberId, businessAccountId: "102290129340398" });
  assert.equal(account.kind, "ok");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [{ name: "welcome", language: "fr", category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "Bonjour {{1}}" }] }],
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
  return { templateId: rows.rows[0].id as string };
}

async function cleanup(client: Client, orgIds: string[], userIds: string[]) {
  await client.query("delete from outbox_event where organization_id = any($1)", [orgIds]);
  await client.query("delete from account_invitation_event where invitation_id in (select id from account_invitation where organization_id = any($1))", [orgIds]);
  await client.query("delete from account_verification_challenge where invitation_id in (select id from account_invitation where organization_id = any($1))", [orgIds]);
  await client.query("delete from account_invitation where organization_id = any($1)", [orgIds]);
  await client.query("delete from whatsapp_message where organization_id = any($1)", [orgIds]);
  await client.query("delete from whatsapp_template where organization_id = any($1)", [orgIds]);
  await client.query("delete from whatsapp_account where organization_id = any($1)", [orgIds]);
  await client.query("delete from admission where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact where organization_id = any($1)", [orgIds]);
  await client.query("delete from organization where id = any($1)", [orgIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

function providerSendOk(messageId: string) {
  return new Response(JSON.stringify({ messages: [{ id: messageId }] }), { status: 200, headers: { "content-type": "application/json" } });
}

function providerTransportError() {
  // HTTP 500 with an unparseable body maps to code "unexpected" → RETRYABLE.
  return new Response("internal error", { status: 500 });
}

function providerPermanentError() {
  return new Response(JSON.stringify({ error: { message: "Rejected", code: 132000, error_data: { details: "reason" } } }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

async function enqueueRealSend(client: Client, adminId: string, orgId: string, phone: string) {
  const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");
  const contact = await seedContact(adminId, orgId, phone);
  const { templateId } = await seedAccountAndTemplate(client, adminId, orgId);
  const result = await sendWhatsAppTemplate(adminId, "STAFF", orgId, { contactId: contact.id, templateId, language: "fr" });
  assert.ok(result.kind === "ok");
  return { contact, messageId: result.id };
}

test("outbox worker: PENDING events are claimed (FOR UPDATE SKIP LOCKED), processed outside the claim tx, and written back SUCCEEDED", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const originalFetch = globalThis.fetch;
    const wamidOne = `wamid.OUTBOX.ONE.${crypto.randomUUID()}`;
    globalThis.fetch = (async () => providerSendOk(wamidOne)) as typeof fetch;
    let enqueued;
    try {
      enqueued = await enqueueRealSend(client, adminId, org.id, "+216 20 123 456");

      const before = await client.query("select status, attempts, locked_at, locked_by from outbox_event where organization_id = $1", [org.id]);
      assert.equal(before.rows[0].status, "PENDING");
      assert.equal(before.rows[0].attempts, 0);

      const result = await runOutboxCycle({ organizationId: org.id });
      assert.equal(result.claimed, 1);
      assert.equal(result.succeeded, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const after = await client.query("select status, attempts, processed_at, last_error_code from outbox_event where organization_id = $1", [org.id]);
    assert.equal(after.rows[0].status, "SUCCEEDED");
    assert.equal(after.rows[0].attempts, 1);
    assert.ok(after.rows[0].processed_at);

    const message = await client.query("select status, provider_message_id from whatsapp_message where id = $1", [enqueued.messageId]);
    assert.equal(message.rows[0].status, "SENT");
    assert.equal(message.rows[0].provider_message_id, wamidOne);

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: an HTTP 5xx from the provider is RETRYABLE — the event returns to PENDING with a future availableAt and a backoff, never FAILED", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle, backoffSeconds } = await import("../../src/server/queue/worker-engine");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerTransportError()) as typeof fetch;
    let result;
    try {
      await enqueueRealSend(client, adminId, org.id, "+216 20 123 456");
      result = await runOutboxCycle({ organizationId: org.id });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(result.claimed, 1);
    assert.equal(result.retried, 1);

    const row = await client.query("select status, attempts, available_at, last_error_code from outbox_event where organization_id = $1", [org.id]);
    assert.equal(row.rows[0].status, "PENDING", "transient failure must be retried, not FAILED");
    assert.equal(row.rows[0].attempts, 1);
    assert.equal(row.rows[0].last_error_code, "INVALID_RESPONSE");
    assert.ok(new Date(row.rows[0].available_at).getTime() > Date.now(), "retry must be scheduled in the future");
    assert.equal(backoffSeconds(1), 5);

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: a provider rejection (132000) is terminal — event FAILED, message FAILED with the provider code, attempts bounded", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerPermanentError()) as typeof fetch;
    let enqueued;
    let result;
    try {
      enqueued = await enqueueRealSend(client, adminId, org.id, "+216 20 123 456");
      result = await runOutboxCycle({ organizationId: org.id });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(result.claimed, 1);
    assert.equal(result.terminal, 1);

    const row = await client.query("select status, last_error_code from outbox_event where organization_id = $1", [org.id]);
    assert.equal(row.rows[0].status, "FAILED");
    assert.equal(row.rows[0].last_error_code, "REJECTED");

    const message = await client.query("select status, provider_error_code from whatsapp_message where id = $1", [enqueued.messageId]);
    assert.equal(message.rows[0].status, "FAILED");
    assert.equal(message.rows[0].provider_error_code, "132000");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: maxAttempts exhaustion on a persistent transient failure goes terminal", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");
    const { db } = await import("../../src/server/db");
    const { eq } = await import("drizzle-orm");
    const { outboxEvent } = await import("../../src/server/db/schema");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerTransportError()) as typeof fetch;
    let enqueued;
    let result;
    try {
      enqueued = await enqueueRealSend(client, adminId, org.id, "+216 20 123 456");

      // Force a tiny maxAttempts so exhaustion is reachable without waiting out backoff.
      await db.update(outboxEvent).set({ maxAttempts: 2 }).where(eq(outboxEvent.organizationId, org.id));

      await runOutboxCycle({ organizationId: org.id, batchSize: 1 });

      // Immediately reclaimable (retryable path → future availableAt); force it
      // back to now so the second (exhausting) attempt runs in the same test.
      await db.update(outboxEvent).set({ availableAt: new Date() }).where(eq(outboxEvent.organizationId, org.id));
      result = await runOutboxCycle({ organizationId: org.id, batchSize: 1 });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(result.claimed, 1);
    assert.equal(result.terminal, 1);

    const row = await client.query("select status, attempts from outbox_event where organization_id = $1", [org.id]);
    assert.equal(row.rows[0].status, "FAILED");
    assert.equal(row.rows[0].attempts, 2);

    const message = await client.query("select status from whatsapp_message where id = $1", [enqueued.messageId]);
    assert.equal(message.rows[0].status, "FAILED");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: stale PROCESSING leases are recovered and the job is re-delivered", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");
    const { db } = await import("../../src/server/db");
    const { eq } = await import("drizzle-orm");
    const { outboxEvent } = await import("../../src/server/db/schema");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const originalFetch = globalThis.fetch;
    const wamidStale = `wamid.OUTBOX.STALE.${crypto.randomUUID()}`;
    globalThis.fetch = (async () => providerSendOk(wamidStale)) as typeof fetch;
    let enqueued;
    let result;
    try {
      enqueued = await enqueueRealSend(client, adminId, org.id, "+216 20 123 456");

      // Simulate a crashed worker: the row was claimed but never finished. A
      // short lease (1s) makes it immediately eligible for recovery.
      await db
        .update(outboxEvent)
        .set({ status: "PROCESSING", attempts: 1, lockedAt: new Date(Date.now() - 120_000), lockedBy: "dead-worker" })
        .where(eq(outboxEvent.organizationId, org.id));

      result = await runOutboxCycle({ organizationId: org.id, leaseSeconds: 1 });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(result.claimed, 1);
    assert.equal(result.succeeded, 1);

    const row = await client.query("select status, locked_by, attempts from outbox_event where organization_id = $1", [org.id]);
    assert.equal(row.rows[0].status, "SUCCEEDED");
    assert.equal(row.rows[0].attempts, 2, "recovery is a second attempt");

    const message = await client.query("select status, provider_message_id from whatsapp_message where id = $1", [enqueued.messageId]);
    assert.equal(message.rows[0].status, "SENT");
    assert.equal(message.rows[0].provider_message_id, wamidStale);

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: two concurrent workers never claim the same row (SKIP LOCKED)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return providerSendOk(`wamid.CONC.${calls}.${crypto.randomUUID()}`);
    }) as typeof fetch;
    let a;
    let b;
    try {
      await enqueueRealSend(client, adminId, org.id, "+216 20 123 456");

      // Two workers race the same claim query. With FOR UPDATE SKIP LOCKED,
      // exactly one claims the single row; the other claims nothing.
      [a, b] = await Promise.all([
        runOutboxCycle({ organizationId: org.id, workerId: "worker-a", leaseSeconds: 1 }),
        runOutboxCycle({ organizationId: org.id, workerId: "worker-b", leaseSeconds: 1 }),
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
    const totalClaimed = a.claimed + b.claimed;
    assert.equal(totalClaimed, 1, "SKIP LOCKED must prevent double-claiming");
    assert.equal(a.claimed + b.claimed === 1 ? a.succeeded + b.succeeded : -1, 1);

    const rows = await client.query("select count(*)::int as n from outbox_event where organization_id = $1 and status = 'SUCCEEDED'", [org.id]);
    assert.equal(rows.rows[0].n, 1);
    assert.equal(calls, 1, "the provider must be called exactly once");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: a poison payload (schema-invalid) is FAILED non-retryably, never thrown into the loop", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");
    const { db } = await import("../../src/server/db");
    const { outboxEvent } = await import("../../src/server/db/schema");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);

    // Bypass the service so we can insert a payload that fails the versioned
    // schema (messageId is not a valid UUID).
    const id = crypto.randomUUID();
    await db.insert(outboxEvent).values({
      id,
      organizationId: org.id,
      aggregateType: "whatsappMessage",
      aggregateId: id,
      eventType: "WHATSAPP_TEMPLATE_SEND",
      payload: { messageId: "not-a-uuid" },
      idempotencyKey: `poison-${crypto.randomUUID()}`,
    });

    const result = await runOutboxCycle({ organizationId: org.id });
    assert.equal(result.claimed, 1);
    assert.equal(result.terminal, 1);

    const row = await client.query("select status, last_error_code from outbox_event where id = $1", [id]);
    assert.equal(row.rows[0].status, "FAILED");
    assert.equal(row.rows[0].last_error_code, "POISON_PAYLOAD");

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: a cross-org payload cannot send from another org's account", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");
    const { enqueueOutboxEvent } = await import("../../src/server/queue/outbox");
    const { db } = await import("../../src/server/db");

    const adminId = await seedUser(client);
    const orgA = await seedOrg(adminId);
    const orgB = await seedOrg(adminId);

    const originalFetch = globalThis.fetch;
    const wamidXorg = `wamid.XORG.${crypto.randomUUID()}`;
    globalThis.fetch = (async () => providerSendOk(wamidXorg)) as typeof fetch;
    let enqueuedB: { kind: "ok"; id: string } | undefined;
    let resultA;
    let resultBCycle;
    try {
      const contactA = await seedContact(adminId, orgA.id, "+216 20 123 456");
      const { templateId: templateB } = await seedAccountAndTemplate(client, adminId, orgB.id);
      const contactB = await seedContact(adminId, orgB.id, "+216 98 765 432");
      const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");
      const resultB = await sendWhatsAppTemplate(adminId, "STAFF", orgB.id, { contactId: contactB.id, templateId: templateB, language: "fr" });
      assert.ok(resultB.kind === "ok");
      enqueuedB = resultB;

      // A forged outbox row under org A referencing org B's message: the
      // handler scopes the lookup to event.organizationId, so it must NOT find
      // org B's message → terminal NON_RETRYABLE without any provider call.
      const messageBId = enqueuedB!.id;
      await db.transaction(async (tx) => {
        await enqueueOutboxEvent(tx, {
          organizationId: orgA.id,
          aggregateType: "whatsappMessage",
          aggregateId: messageBId,
          eventType: "WHATSAPP_TEMPLATE_SEND",
          payload: { messageId: messageBId },
          idempotencyKey: `forged-${crypto.randomUUID()}`,
        });
      });
      // Ignore contactA unused warning.
      void contactA;

      resultA = await runOutboxCycle({ organizationId: orgA.id });
      resultBCycle = await runOutboxCycle({ organizationId: orgB.id });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(resultA.claimed, 1);
    assert.equal(resultA.terminal, 1);

    const forged = await client.query("select status, last_error_code from outbox_event where organization_id = $1 and last_error_code = 'MESSAGE_NOT_FOUND'", [orgA.id]);
    assert.equal(forged.rowCount, 1);

    // org B's real job is untouched and still delivered independently.
    assert.equal(resultBCycle.succeeded, 1);
    const messageB = await client.query("select status, provider_message_id from whatsapp_message where id = $1", [enqueuedB!.id]);
    assert.equal(messageB.rows[0].status, "SENT");
    assert.equal(messageB.rows[0].provider_message_id, wamidXorg);

    await cleanup(client, [orgA.id, orgB.id], [adminId]);
  });
});

test("outbox worker: same message never yields a second job across repeated enqueues", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");
    const { sendWhatsAppTemplate } = await import("../../src/server/services/whatsapp");

    const adminId = await seedUser(client);
    const org = await seedOrg(adminId);
    const contact = await seedContact(adminId, org.id, "+216 20 123 456");
    const { templateId } = await seedAccountAndTemplate(client, adminId, org.id);

    const requestId = `dup-${crypto.randomUUID()}`;
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return providerSendOk(`wamid.DUP.${calls}.${crypto.randomUUID()}`);
    }) as typeof fetch;
    try {
      const first = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr", requestId });
      assert.ok(first.kind === "ok");
      const second = await sendWhatsAppTemplate(adminId, "STAFF", org.id, { contactId: contact.id, templateId, language: "fr", requestId });
      assert.ok(second.kind === "ok");

      const jobs = await client.query("select count(*)::int as n from outbox_event where organization_id = $1", [org.id]);
      assert.equal(jobs.rows[0].n, 1);

      await runOutboxCycle({ organizationId: org.id });
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }

    await cleanup(client, [org.id], [adminId]);
  });
});

test("outbox worker: OTP sends are delivered with the decrypted OTP to the provider and never stored in plaintext", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { runOutboxCycle } = await import("../../src/server/queue/worker-engine");
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact } = await import("../../src/server/services/crm");
    const { createAdmission, decideAdmission } = await import("../../src/server/services/admissions");
    const { upsertWhatsAppAccount, syncWhatsAppTemplates } = await import("../../src/server/services/whatsapp");
    const { createAccountInvitation, requestInvitationOtp } = await import("../../src/server/services/account-invitations");
    const { hashInvitationToken } = await import("../../src/server/security/invitation-crypto");

    const adminId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "OTP Org", slug: `ox-otp-${crypto.randomUUID()}` }, adminId);
    const contact = await createCrmContact(adminId, org.id, { firstName: "O", lastName: "Otp", phone: "+216 20 123 456" });
    assert.ok(contact.kind === "ok");
    const admission = await createAdmission(adminId, "OWNER", org.id, { contactId: contact.id });
    assert.ok(admission.kind === "ok");
    await decideAdmission(adminId, "OWNER", org.id, admission.id, "ACCEPTED");
    await upsertWhatsAppAccount(adminId, "OWNER", org.id, { phoneNumberId: `pni-${crypto.randomUUID()}`.slice(0, 40), businessAccountId: "102290129340398" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { name: "account_invitation", language: "fr", category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "{{1}} vous invite: {{2}}" }] },
            { name: "otp_verification", language: "fr", category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "Code: {{1}}" }] },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    try {
      const synced = await syncWhatsAppTemplates(adminId, "OWNER", org.id);
      assert.equal(synced.kind, "ok");
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Create invitation + capture token via worker-driven delivery.
    let rawToken = "";
    let capturedParams: string[] | undefined;
    const capFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      if (init?.body) {
        try {
          const payload = JSON.parse(String(init.body));
          const bodyComponent = payload?.template?.components?.find((c: { type: string }) => c.type === "body");
          capturedParams = bodyComponent?.parameters?.map((p: { text: string }) => p.text);
        } catch {
          // ignore
        }
      }
      return providerSendOk(`wamid.OTP.INV.${crypto.randomUUID()}`);
    }) as typeof fetch;
    let invitationId: string | undefined;
    try {
      const created = await createAccountInvitation(adminId, "OWNER", org.id, contact.id);
      assert.ok(created.kind === "ok" && created.sent);
      invitationId = created.id;
      await runOutboxCycle({ organizationId: org.id });
    } finally {
      globalThis.fetch = capFetch;
    }
    assert.ok(invitationId, "invitation must be created");
    const urlParam = capturedParams?.[1] ?? "";
    rawToken = decodeURIComponent(urlParam.split("/invitation/")[1] ?? "");
    assert.ok(rawToken.length > 0);
    assert.equal(hashInvitationToken(rawToken).length, 64);

    // Now the OTP send: capture the decrypted OTP the worker sends to Meta.
    let capturedOtp = "";
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      if (init?.body) {
        try {
          const payload = JSON.parse(String(init.body));
          const bodyComponent = payload?.template?.components?.find((c: { type: string }) => c.type === "body");
          capturedOtp = bodyComponent?.parameters?.[0]?.text ?? "";
        } catch {
          // ignore
        }
      }
      return providerSendOk(`wamid.OTP.CODE.${crypto.randomUUID()}`);
    }) as typeof fetch;
    try {
      const otpReq = await requestInvitationOtp(rawToken);
      assert.equal(otpReq.kind, "ok");
      await runOutboxCycle({ organizationId: org.id });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.match(capturedOtp, /^\d{6}$/);

    // The OTP must never appear anywhere in the database (ciphertext only),
    // and the outbox payload must not carry it either.
    const dbDump = await client.query(
      `select payload::text, last_error_message, last_error_code from outbox_event where organization_id = $1
       union all
       select coalesce(body_parameters::text, ''), coalesce(body_parameters_encrypted::text, ''), '' from whatsapp_message where organization_id = $1`,
      [org.id],
    );
    const serialized = dbDump.rows.map((r) => Object.values(r).join(" | ")).join(" || ");
    assert.ok(!serialized.includes(capturedOtp), "the OTP must not appear in plaintext anywhere in the DB");

    const otpMessages = await client.query(
      `select body_parameters, body_parameters_encrypted, status from whatsapp_message where organization_id = $1 and template_name = 'otp_verification'`,
      [org.id],
    );
    assert.equal(otpMessages.rows[0].status, "SENT");
    assert.equal(otpMessages.rows[0].body_parameters, null, "OTP must be scrubbed after delivery");
    assert.equal(otpMessages.rows[0].body_parameters_encrypted, null, "ciphertext must be scrubbed after delivery");

    await cleanup(client, [org.id], [adminId]);
  });
});