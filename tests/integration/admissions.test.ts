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
  const email = `adm-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

async function seedContact(adminId: string, orgId: string, firstName: string, lastName: string) {
  const { createCrmContact } = await import("../../src/server/services/crm");
  const result = await createCrmContact(adminId, orgId, { firstName, lastName });
  assert.ok(result.kind === "ok");
  return result;
}

async function cleanup(client: Client, orgIds: string[], userIds: string[]) {
  await client.query("delete from admission where organization_id = any($1)", [orgIds]);
  await client.query("delete from assessment where organization_id = any($1)", [orgIds]);
  await client.query("delete from appointment_event where appointment_id in (select id from appointment where organization_id = any($1))", [orgIds]);
  await client.query("delete from appointment where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact where organization_id = any($1)", [orgIds]);
  await client.query("delete from organization where id = any($1)", [orgIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

test("createAdmission: opens a PENDING dossier; only STAFF+ may create", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { createAdmission } = await import("../../src/server/services/admissions");
    const { getAdmission } = await import("../../src/server/queries/admission");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const viewerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Adm Org", slug: `adm-${crypto.randomUUID()}` }, ownerId);
    await addOrganizationMember(adminId, org.id, viewerId, "VIEWER");
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const result = await createAdmission(adminId, "OWNER", org.id, { contactId: contact.id });
    assert.equal(result.kind, "ok");
    assert.ok(result.kind === "ok");

    const detail = await getAdmission(org.id, result.id);
    assert.equal(detail?.admission.decision, "PENDING");

    // VIEWER is denied.
    assert.equal((await createAdmission(viewerId, "VIEWER", org.id, { contactId: contact.id })).kind, "forbidden");

    const audit = await client.query(`select action from audit_logs where entity_type = 'admission' and entity_id = $1`, [result.id]);
    assert.equal(audit.rows[0]?.action, "crm.admission.create");

    await cleanup(client, [org.id], [adminId, ownerId, viewerId]);
  });
});

test("createAdmission: rejects a contact from another organization", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAdmission } = await import("../../src/server/services/admissions");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `adm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `adm-b-${crypto.randomUUID()}` }, ownerBId);
    const contactA = await seedContact(adminId, orgA.id, "Aya", "Prospect");

    const result = await createAdmission(adminId, "OWNER", orgB.id, { contactId: contactA.id });
    assert.equal(result.kind, "invalid_contact");

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("decideAdmission: ACCEPTED is final and recorded with ADMISSION_ACCEPTED activity; a second decision is rejected", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAdmission, decideAdmission } = await import("../../src/server/services/admissions");
    const { getAdmission } = await import("../../src/server/queries/admission");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Adm Org", slug: `adm-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const created = await createAdmission(adminId, "OWNER", org.id, { contactId: contact.id });
    assert.equal(created.kind, "ok");

    assert.equal((await decideAdmission(adminId, "OWNER", org.id, created.id, "ACCEPTED", "Excellent profil")).kind, "ok");

    const detail = await getAdmission(org.id, created.id);
    assert.equal(detail?.admission.decision, "ACCEPTED");
    assert.equal(detail?.admission.decidedByUserId, adminId);
    assert.equal(detail?.admission.reason, "Excellent profil");
    assert.notEqual(detail?.admission.decidedAt, null);

    // Terminal.
    assert.equal((await decideAdmission(adminId, "OWNER", org.id, created.id, "REJECTED")).kind, "invalid_transition");

    const activity = await client.query(
      `select type from crm_contact_activity where contact_id = $1 and type = 'ADMISSION_ACCEPTED'`,
      [contact.id],
    );
    assert.equal(activity.rows.length, 1);

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("decideAdmission: STAFF cannot finalize; MANAGER can", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { createAdmission, decideAdmission } = await import("../../src/server/services/admissions");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const staffId = await seedUser(client);
    const managerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Adm Org", slug: `adm-${crypto.randomUUID()}` }, ownerId);
    await addOrganizationMember(adminId, org.id, staffId, "STAFF");
    await addOrganizationMember(adminId, org.id, managerId, "MANAGER");
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const created = await createAdmission(adminId, "OWNER", org.id, { contactId: contact.id });
    assert.equal(created.kind, "ok");

    assert.equal((await decideAdmission(staffId, "STAFF", org.id, created.id, "ACCEPTED")).kind, "forbidden");
    assert.equal((await decideAdmission(managerId, "MANAGER", org.id, created.id, "ACCEPTED")).kind, "ok");

    await cleanup(client, [org.id], [adminId, ownerId, staffId, managerId]);
  });
});

test("canContactBeInvited: true only for an ACTIVE contact with an ACCEPTED admission (read-only, no side effects)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAdmission, decideAdmission, canContactBeInvited } = await import("../../src/server/services/admissions");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Adm Org", slug: `adm-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    assert.equal(await canContactBeInvited(org.id, contact.id), false, "no dossier yet -> not invitable");

    const created = await createAdmission(adminId, "OWNER", org.id, { contactId: contact.id });
    assert.ok(created.kind === "ok");
    assert.equal(await canContactBeInvited(org.id, contact.id), false, "PENDING dossier -> not invitable");

    await decideAdmission(adminId, "OWNER", org.id, created.id, "ACCEPTED");
    assert.equal(await canContactBeInvited(org.id, contact.id), true, "ACCEPTED dossier -> invitable");

    const count = await client.query("select count(*)::int as n from admission where contact_id = $1", [contact.id]);
    assert.equal(count.rows[0].n, 1, "canContactBeInvited must not create anything");

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("canContactBeInvited: an ACCEPTED admission in org A does not invite the same contact via org B", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAdmission, decideAdmission, canContactBeInvited } = await import("../../src/server/services/admissions");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `adm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `adm-b-${crypto.randomUUID()}` }, ownerBId);
    const contactA = await seedContact(adminId, orgA.id, "Aya", "Prospect");

    const created = await createAdmission(adminId, "OWNER", orgA.id, { contactId: contactA.id });
    assert.ok(created.kind === "ok");
    await decideAdmission(adminId, "OWNER", orgA.id, created.id, "ACCEPTED");

    assert.equal(await canContactBeInvited(orgA.id, contactA.id), true);
    assert.equal(await canContactBeInvited(orgB.id, contactA.id), false);

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});