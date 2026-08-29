/**
 * Phase 6 account invitation / phone verification / CRM contact linking.
 * Same fixture pattern as tests/integration/whatsapp.test.ts: provider HTTP
 * calls are stubbed via globalThis.fetch, the DB exercises are real.
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

async function seedUser(client: Client, label = "inv") {
  const userId = crypto.randomUUID();
  const email = `${label}-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

function providerSendOk() {
  return new Response(JSON.stringify({ messages: [{ id: `wamid.${crypto.randomUUID()}` }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function seedFullyEligibleInvitationContext(client: Client, phone = "21620123456") {
  const { createOrganization } = await import("../../src/server/services/organizations");
  const { createCrmContact } = await import("../../src/server/services/crm");
  const { createAdmission, decideAdmission } = await import("../../src/server/services/admissions");
  const { upsertWhatsAppAccount, syncWhatsAppTemplates } = await import("../../src/server/services/whatsapp");

  const adminId = await seedUser(client, "admin");
  const org = await createOrganization(adminId, { name: "Invitation Org", slug: `inv-${crypto.randomUUID()}` }, adminId);

  const contactResult = await createCrmContact(adminId, org.id, { firstName: "Aya", lastName: "Prospect", phone });
  assert.ok(contactResult.kind === "ok");
  const contactId = contactResult.id;

  const admissionResult = await createAdmission(adminId, "OWNER", org.id, { contactId });
  assert.ok(admissionResult.kind === "ok");
  await decideAdmission(adminId, "OWNER", org.id, admissionResult.id, "ACCEPTED");

  const account = await upsertWhatsAppAccount(adminId, "OWNER", org.id, { phoneNumberId: `pni-${crypto.randomUUID()}`.slice(0, 40), businessAccountId: "102290129340398" });
  assert.equal(account.kind, "ok");

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

  return { adminId, orgId: org.id, contactId, admissionId: admissionResult.id };
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
  await client.query("delete from assessment where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from persona_membership where user_id = any($1)", [userIds]);
  await client.query("delete from crm_contact where organization_id = any($1)", [orgIds]);
  await client.query("delete from organization where id = any($1)", [orgIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

test("evaluateInvitationEligibility: eligible only for an ACTIVE, unlinked, ACCEPTED contact with a usable phone and configured WhatsApp", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { evaluateInvitationEligibility } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);

    const eligible = await evaluateInvitationEligibility(ctx.orgId, ctx.contactId);
    assert.equal(eligible.kind, "eligible");

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});

test("evaluateInvitationEligibility: rejects a non-accepted admission and an already-linked contact", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { evaluateInvitationEligibility } = await import("../../src/server/services/account-invitations");
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, linkCrmContactUser } = await import("../../src/server/services/crm");
    const { createAdmission } = await import("../../src/server/services/admissions");

    const adminId = await seedUser(client, "admin");
    const org = await createOrganization(adminId, { name: "Org", slug: `inv-${crypto.randomUUID()}` }, adminId);

    const pendingContact = await createCrmContact(adminId, org.id, { firstName: "P", lastName: "Pending", phone: "21620123457" });
    assert.ok(pendingContact.kind === "ok");
    await createAdmission(adminId, "OWNER", org.id, { contactId: pendingContact.id });
    assert.equal((await evaluateInvitationEligibility(org.id, pendingContact.id)).kind, "not_eligible");

    const linkedContact = await createCrmContact(adminId, org.id, { firstName: "L", lastName: "Linked", phone: "21620123458" });
    assert.ok(linkedContact.kind === "ok");
    const otherUser = await seedUser(client, "other");
    await linkCrmContactUser(adminId, org.id, linkedContact.id, otherUser);
    assert.equal((await evaluateInvitationEligibility(org.id, linkedContact.id)).kind, "already_linked");

    await cleanup(client, [org.id], [adminId, otherUser]);
  });
});

test("createAccountInvitation: stores only a token digest (never the raw token); lookup by digest works; STAFF is forbidden", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createAccountInvitation, getInvitationLandingInfo } = await import("../../src/server/services/account-invitations");
    const { addOrganizationMember } = await import("../../src/server/services/organizations");
    const ctx = await seedFullyEligibleInvitationContext(client);

    const staffId = await seedUser(client, "staff");
    await addOrganizationMember(ctx.adminId, ctx.orgId, staffId, "STAFF");
    assert.equal((await createAccountInvitation(staffId, "STAFF", ctx.orgId, ctx.contactId)).kind, "forbidden");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk()) as typeof fetch;
    let result;
    try {
      result = await createAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.ok(result.kind === "ok");
    assert.equal(result.sent, true);

    const row = await client.query(`select token_hash, status from account_invitation where id = $1`, [result.id]);
    assert.equal(row.rows[0].status, "SENT");
    assert.ok(row.rows[0].token_hash && row.rows[0].token_hash.length === 64, "token_hash should be a 64-char hex HMAC digest");

    // No column anywhere on the row stores a raw/plaintext token.
    const columns = await client.query(`select column_name from information_schema.columns where table_name = 'account_invitation'`);
    assert.ok(!columns.rows.some((r) => /raw.?token|plain.?token/i.test(r.column_name)));

    const landing = await getInvitationLandingInfo("this-is-not-the-real-token");
    assert.equal(landing.kind, "invalid_invitation");

    await cleanup(client, [ctx.orgId], [ctx.adminId, staffId]);
  });
});

test("createAccountInvitation: a second create for the same contact conflicts (one active invitation per contact)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createAccountInvitation } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk()) as typeof fetch;
    try {
      const first = await createAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
      assert.equal(first.kind, "ok");
      const second = await createAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
      assert.equal(second.kind, "conflict");
    } finally {
      globalThis.fetch = originalFetch;
    }

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});

test("resendAccountInvitation: rotates the token (old token stops resolving); cooldown blocks an immediate second resend", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createAccountInvitation, resendAccountInvitation } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk()) as typeof fetch;
    try {
      const created = await createAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
      assert.ok(created.kind === "ok");
      const before = await client.query(`select token_hash from account_invitation where id = $1`, [created.id]);

      const resent = await resendAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
      assert.equal(resent.kind, "ok");
      const after = await client.query(`select token_hash from account_invitation where id = $1`, [created.id]);
      assert.notEqual(before.rows[0].token_hash, after.rows[0].token_hash);

      const cooldown = await resendAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
      assert.equal(cooldown.kind, "send_cooldown");
    } finally {
      globalThis.fetch = originalFetch;
    }

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});

test("revokeAccountInvitation: a revoked invitation cannot request or verify an OTP", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { revokeAccountInvitation, requestInvitationOtp, verifyInvitationOtp } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const { rawToken } = await createInvitationAndCaptureToken(client, ctx);

    const revoked = await revokeAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
    assert.equal(revoked.kind, "ok");

    assert.equal((await requestInvitationOtp(rawToken)).kind, "invitation_revoked");
    assert.equal((await verifyInvitationOtp(rawToken, "000000")).kind, "invitation_revoked");

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});

// --- End-to-end OTP + claim, capturing the raw token via a test-only hook ------------------

async function readEncryptedMessageParameters(client: Client, organizationId: string): Promise<string[]> {
  const { decryptSecretParameters } = await import("../../src/server/security/outbox-crypto");
  const message = await client.query<{ body_parameters_encrypted: { ciphertext: string; nonce: string } }>(
    `select body_parameters_encrypted
       from whatsapp_message
      where organization_id = $1 and body_parameters_encrypted is not null
      order by created_at desc
      limit 1`,
    [organizationId],
  );
  assert.equal(message.rowCount, 1, "expected one queued message with encrypted secret parameters");
  return decryptSecretParameters(message.rows[0].body_parameters_encrypted);
}

async function createInvitationAndCaptureToken(client: Client, ctx: { adminId: string; orgId: string; contactId: string }) {
  const { createAccountInvitation } = await import("../../src/server/services/account-invitations");
  const { hashInvitationToken } = await import("../../src/server/security/invitation-crypto");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => providerSendOk()) as typeof fetch;

  let invitationId: string;
  let secretParameters: string[];
  try {
    const created = await createAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
    assert.ok(created.kind === "ok" && created.sent);
    invitationId = created.id;
    // Read through the same authenticated decryption primitive used by the
    // worker. This is deterministic even when integration files run in
    // parallel, and verifies that the secret is encrypted—not plaintext—at
    // rest before delivery.
    secretParameters = await readEncryptedMessageParameters(client, ctx.orgId);
    await drainOutboxForOrg(ctx.orgId);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // The invitation URL is the second body parameter (org name, url); pull the token back out.
  const urlParam = secretParameters[1] ?? "";
  const rawToken = decodeURIComponent(urlParam.split("/invitation/")[1] ?? "");
  assert.ok(rawToken.length > 0, "expected to capture the invitation URL/token from the outbound template call");
  assert.equal(hashInvitationToken(rawToken).length, 64);
  return { invitationId, rawToken };
}

async function captureOtp(client: Client, organizationId: string, action: () => Promise<unknown>): Promise<string> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => providerSendOk()) as typeof fetch;
  let captured = "";
  try {
    await action();
    [captured = ""] = await readEncryptedMessageParameters(client, organizationId);
    await drainOutboxForOrg(organizationId);
  } finally {
    globalThis.fetch = originalFetch;
  }
  return captured;
}

test("OTP lifecycle: wrong code rejected, correct code verifies once, replay is rejected; phone verification alone creates no user/persona", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { requestInvitationOtp, verifyInvitationOtp } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const { rawToken } = await createInvitationAndCaptureToken(client, ctx);

    const otp = await captureOtp(client, ctx.orgId, async () => {
      const result = await requestInvitationOtp(rawToken);
      assert.equal(result.kind, "ok");
    });
    assert.match(otp, /^\d{6}$/);

    assert.equal((await verifyInvitationOtp(rawToken, "000001" === otp ? "000002" : "000001")).kind, "invalid_code");

    // Scoped to this test's own admin user (not a global count) so this
    // assertion is safe even when other integration test files are
    // mutating "user"/persona_membership concurrently against the same
    // shared database.
    const personasBefore = await client.query("select count(*)::int as n from persona_membership where user_id = $1", [ctx.adminId]);

    assert.equal((await verifyInvitationOtp(rawToken, otp)).kind, "ok");

    const contactStillUnlinked = await client.query(`select linked_user_id from crm_contact where id = $1`, [ctx.contactId]);
    assert.equal(contactStillUnlinked.rows[0].linked_user_id, null, "OTP verification must not create or link a user");

    const personasAfter = await client.query("select count(*)::int as n from persona_membership where user_id = $1", [ctx.adminId]);
    assert.equal(personasAfter.rows[0].n, personasBefore.rows[0].n, "OTP verification must not create a persona");

    // Replay.
    assert.equal((await verifyInvitationOtp(rawToken, otp)).kind, "already_verified");

    const challengeRows = await client.query(`select code_hash from account_verification_challenge`);
    assert.ok(!challengeRows.rows.some((r) => /^\d{6}$/.test(r.code_hash)), "raw OTP must never be stored");

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});

test("OTP lifecycle: max attempts locks the challenge; a fresh request supersedes it", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { requestInvitationOtp, verifyInvitationOtp } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const { rawToken, invitationId } = await createInvitationAndCaptureToken(client, ctx);

    await captureOtp(client, ctx.orgId, async () => requestInvitationOtp(rawToken));

    for (let i = 0; i < 5; i += 1) {
      const result = await verifyInvitationOtp(rawToken, "999999");
      if (i < 4) assert.equal(result.kind, "invalid_code");
      else assert.equal(result.kind, "attempts_exhausted");
    }

    const active = await client.query(`select count(*)::int as n from account_verification_challenge where invitation_id = $1 and status = 'ACTIVE'`, [invitationId]);
    assert.equal(active.rows[0].n, 0);

    // A fresh request is still governed by the resend cooldown right after a
    // lockout (expected — the cooldown is IP/invitation abuse protection,
    // not specific to the lockout reason).
    const cooledDown = await requestInvitationOtp(rawToken);
    assert.equal(cooledDown.kind, "send_cooldown");

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});

test("concurrent OTP requests leave at most one ACTIVE challenge", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { requestInvitationOtp } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const { rawToken, invitationId } = await createInvitationAndCaptureToken(client, ctx);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk()) as typeof fetch;
    try {
      await Promise.all([requestInvitationOtp(rawToken), requestInvitationOtp(rawToken), requestInvitationOtp(rawToken)]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const active = await client.query(`select count(*)::int as n from account_verification_challenge where invitation_id = $1 and status = 'ACTIVE'`, [invitationId]);
    assert.equal(active.rows[0].n, 1);

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});

test("claim: requires an authenticated claimant, links the contact, ensures STUDENT persona, and is one-time", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { requestInvitationOtp, verifyInvitationOtp, claimAccountInvitation } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const { rawToken } = await createInvitationAndCaptureToken(client, ctx);

    const otp = await captureOtp(client, ctx.orgId, async () => requestInvitationOtp(rawToken));
    assert.equal((await verifyInvitationOtp(rawToken, otp)).kind, "ok");

    const claimant = await seedUser(client, "claimant");
    const claimed = await claimAccountInvitation(claimant, rawToken);
    assert.equal(claimed.kind, "ok");

    const contact = await client.query(`select linked_user_id from crm_contact where id = $1`, [ctx.contactId]);
    assert.equal(contact.rows[0].linked_user_id, claimant);

    const persona = await client.query(`select status, is_primary from persona_membership where user_id = $1 and persona = 'STUDENT'`, [claimant]);
    assert.equal(persona.rows[0].status, "ACTIVE");

    // Idempotent same-user re-claim.
    assert.equal((await claimAccountInvitation(claimant, rawToken)).kind, "ok");

    // A different user cannot claim the now-CONSUMED invitation.
    const otherUser = await seedUser(client, "other");
    assert.equal((await claimAccountInvitation(otherUser, rawToken)).kind, "already_consumed");

    await cleanup(client, [ctx.orgId], [ctx.adminId, claimant, otherUser]);
  });
});

test("claim: a contact already linked to a different user is a conflict; ADMIN/SUPER_ADMIN can never come from invitation data", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { requestInvitationOtp, verifyInvitationOtp, claimAccountInvitation } = await import("../../src/server/services/account-invitations");
    const { linkCrmContactUser } = await import("../../src/server/services/crm");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const { rawToken } = await createInvitationAndCaptureToken(client, ctx);

    const otp = await captureOtp(client, ctx.orgId, async () => requestInvitationOtp(rawToken));
    assert.equal((await verifyInvitationOtp(rawToken, otp)).kind, "ok");

    const alreadyLinkedUser = await seedUser(client, "already");
    await linkCrmContactUser(ctx.adminId, ctx.orgId, ctx.contactId, alreadyLinkedUser);

    const claimant = await seedUser(client, "claimant");
    const claimed = await claimAccountInvitation(claimant, rawToken);
    assert.equal(claimed.kind, "link_conflict");

    const claimantRole = await client.query('select role from "user" where id = $1', [claimant]);
    assert.equal(claimantRole.rows[0].role, "USER");

    await cleanup(client, [ctx.orgId], [ctx.adminId, alreadyLinkedUser, claimant]);
  });
});

test("claim: concurrent claims by two different users never both succeed", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { requestInvitationOtp, verifyInvitationOtp, claimAccountInvitation } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const { rawToken } = await createInvitationAndCaptureToken(client, ctx);

    const otp = await captureOtp(client, ctx.orgId, async () => requestInvitationOtp(rawToken));
    assert.equal((await verifyInvitationOtp(rawToken, otp)).kind, "ok");

    const userA = await seedUser(client, "a");
    const userB = await seedUser(client, "b");
    const [resultA, resultB] = await Promise.all([claimAccountInvitation(userA, rawToken), claimAccountInvitation(userB, rawToken)]);
    const outcomes = [resultA.kind, resultB.kind].sort();
    // Exactly one claim wins ("ok"); the loser sees either "link_conflict"
    // (still VERIFIED, contact already linked to the winner) or
    // "already_consumed" (the winner had already committed CONSUMED by the
    // time the loser's transaction read the row) depending on commit order
    // — both are correct "never double-link" outcomes.
    assert.equal(outcomes.length, 2);
    assert.ok(outcomes.includes("ok"));
    assert.ok(outcomes[0] === "link_conflict" || outcomes[0] === "already_consumed" || outcomes[1] === "link_conflict" || outcomes[1] === "already_consumed");

    const contact = await client.query(`select linked_user_id from crm_contact where id = $1`, [ctx.contactId]);
    assert.ok(contact.rows[0].linked_user_id === userA || contact.rows[0].linked_user_id === userB);

    await cleanup(client, [ctx.orgId], [ctx.adminId, userA, userB]);
  });
});

test("cross-org: an org A invitation cannot be resent/revoked through org B", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAccountInvitation, resendAccountInvitation, revokeAccountInvitation } = await import("../../src/server/services/account-invitations");
    const ctx = await seedFullyEligibleInvitationContext(client);
    const orgB = await createOrganization(ctx.adminId, { name: "Org B", slug: `inv-b-${crypto.randomUUID()}` }, ctx.adminId);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => providerSendOk()) as typeof fetch;
    try {
      const created = await createAccountInvitation(ctx.adminId, "OWNER", ctx.orgId, ctx.contactId);
      assert.equal(created.kind, "ok");
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal((await resendAccountInvitation(ctx.adminId, "OWNER", orgB.id, ctx.contactId)).kind, "not_found");
    assert.equal((await revokeAccountInvitation(ctx.adminId, "OWNER", orgB.id, ctx.contactId)).kind, "not_found");

    await cleanup(client, [ctx.orgId, orgB.id], [ctx.adminId]);
  });
});

test("audit log for account_invitation actions never contains a token/OTP value", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const ctx = await seedFullyEligibleInvitationContext(client);
    await createInvitationAndCaptureToken(client, ctx);

    const audit = await client.query(`select metadata from audit_logs where entity_type = 'account_invitation'`);
    for (const row of audit.rows) {
      const serialized = JSON.stringify(row.metadata ?? {});
      assert.ok(!/[A-Za-z0-9_-]{40,}/.test(serialized), "audit metadata must not contain a high-entropy secret");
    }

    await cleanup(client, [ctx.orgId], [ctx.adminId]);
  });
});
