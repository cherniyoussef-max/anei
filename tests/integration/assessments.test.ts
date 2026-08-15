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
  const email = `ass-${userId}@example.test`;
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

test("createAssessment: creates a DRAFT assessment with ASSESSMENT_CREATED activity; STAFF can only assess themselves", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { createAssessment } = await import("../../src/server/services/assessments");
    const { getAssessment } = await import("../../src/server/queries/admission");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const staffId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Ass Org", slug: `ass-${crypto.randomUUID()}` }, ownerId);
    await addOrganizationMember(adminId, org.id, staffId, "STAFF");
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const result = await createAssessment(staffId, "STAFF", org.id, { contactId: contact.id, assessorUserId: staffId });
    assert.equal(result.kind, "ok");
    assert.ok(result.kind === "ok");

    const detail = await getAssessment(org.id, result.id);
    assert.equal(detail?.assessment.status, "DRAFT");
    assert.equal(detail?.assessment.assessorUserId, staffId);

    // STAFF may not assess on behalf of someone else.
    const other = await createAssessment(staffId, "STAFF", org.id, { contactId: contact.id, assessorUserId: ownerId });
    assert.equal(other.kind, "forbidden");

    const audit = await client.query(`select action from audit_logs where entity_type = 'assessment' and entity_id = $1`, [result.id]);
    assert.equal(audit.rows[0]?.action, "crm.assessment.create");

    await cleanup(client, [org.id], [adminId, ownerId, staffId]);
  });
});

test("createAssessment: rejects an assessor who is not an ACTIVE organization member", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAssessment } = await import("../../src/server/services/assessments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const outsiderId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Ass Org", slug: `ass-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const result = await createAssessment(adminId, "OWNER", org.id, { contactId: contact.id, assessorUserId: outsiderId });
    assert.equal(result.kind, "invalid_assessor");

    await cleanup(client, [org.id], [adminId, ownerId, outsiderId]);
  });
});

test("createAssessment: a contact from another organization is rejected (cross-org reference)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAssessment } = await import("../../src/server/services/assessments");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `ass-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `ass-b-${crypto.randomUUID()}` }, ownerBId);
    const contactA = await seedContact(adminId, orgA.id, "Aya", "Prospect");

    const result = await createAssessment(adminId, "OWNER", orgB.id, { contactId: contactA.id });
    assert.equal(result.kind, "invalid_contact");

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("assessment lifecycle: DRAFT can be updated and completed; COMPLETED is immutable and cannot be re-updated", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAssessment, updateAssessment, completeAssessment } = await import("../../src/server/services/assessments");
    const { getAssessment } = await import("../../src/server/queries/admission");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Ass Org", slug: `ass-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const created = await createAssessment(adminId, "OWNER", org.id, { contactId: contact.id, assessorUserId: ownerId });
    assert.equal(created.kind, "ok");

    assert.equal((await updateAssessment(adminId, "OWNER", org.id, created.id, { score: 14, maxScore: 20, summary: "Bon niveau" })).kind, "ok");
    assert.equal((await completeAssessment(adminId, "OWNER", org.id, created.id)).kind, "ok");

    const completed = await getAssessment(org.id, created.id);
    assert.equal(completed?.assessment.status, "COMPLETED");
    assert.equal(completed?.assessment.score, 14);
    assert.notEqual(completed?.assessment.completedAt, null);

    // Immutable after completion.
    assert.equal((await updateAssessment(adminId, "OWNER", org.id, created.id, { score: 19 })).kind, "invalid_transition");
    assert.equal((await completeAssessment(adminId, "OWNER", org.id, created.id)).kind, "invalid_transition");

    const activity = await client.query(
      `select type from crm_contact_activity where contact_id = $1 and type = 'ASSESSMENT_COMPLETED'`,
      [contact.id],
    );
    assert.equal(activity.rows.length, 1);

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("assessment scoring: score cannot exceed maxScore", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAssessment, updateAssessment, completeAssessment } = await import("../../src/server/services/assessments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Ass Org", slug: `ass-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const created = await createAssessment(adminId, "OWNER", org.id, { contactId: contact.id, assessorUserId: ownerId });
    assert.equal(created.kind, "ok");

    assert.equal((await updateAssessment(adminId, "OWNER", org.id, created.id, { score: 21, maxScore: 20 })).kind, "invalid_score");
    assert.equal((await completeAssessment(adminId, "OWNER", org.id, created.id)).kind, "ok");

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("a STAFF member cannot complete another assessor's assessment; MANAGER can", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { createAssessment, completeAssessment } = await import("../../src/server/services/assessments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const staffAId = await seedUser(client);
    const staffBId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Ass Org", slug: `ass-${crypto.randomUUID()}` }, ownerId);
    await addOrganizationMember(adminId, org.id, staffAId, "STAFF");
    await addOrganizationMember(adminId, org.id, staffBId, "STAFF");
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const created = await createAssessment(adminId, "OWNER", org.id, { contactId: contact.id, assessorUserId: staffAId });
    assert.equal(created.kind, "ok");

    assert.equal((await completeAssessment(adminId, "STAFF", org.id, created.id)).kind, "forbidden");
    assert.equal((await completeAssessment(staffBId, "STAFF", org.id, created.id)).kind, "forbidden");
    assert.equal((await completeAssessment(adminId, "OWNER", org.id, created.id)).kind, "ok");

    await cleanup(client, [org.id], [adminId, ownerId, staffAId, staffBId]);
  });
});