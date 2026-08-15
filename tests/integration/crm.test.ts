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
  const email = `crm-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

async function cleanup(client: Client, orgIds: string[], userIds: string[]) {
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact_note where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact_tag where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_tag where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_pipeline_stage where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_pipeline where organization_id = any($1)", [orgIds]);
  await client.query("delete from organization where id = any($1)", [orgIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

test("createCrmContact: creates without linkedUserId and writes a CONTACT_CREATED activity + audit row", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact } = await import("../../src/server/services/crm");
    const { getCrmContact, getContactActivity } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "CRM Org", slug: `crm-${crypto.randomUUID()}` }, ownerId);

    const result = await createCrmContact(adminId, org.id, { firstName: "Léa", lastName: "Test" });
    assert.equal(result.kind, "ok");
    assert.ok(result.kind === "ok");

    const contact = await getCrmContact(org.id, result.id);
    assert.equal(contact?.linkedUserId, null);

    const activity = await getContactActivity(result.id);
    assert.equal(activity.items[0]?.type, "CONTACT_CREATED");

    const audit = await client.query(`select action from audit_logs where entity_type = 'crm_contact' and entity_id = $1`, [result.id]);
    assert.equal(audit.rows[0]?.action, "crm.contact.create");

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("linkCrmContactUser: links to an existing user; a second contact cannot link the same user in the same organization", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, linkCrmContactUser } = await import("../../src/server/services/crm");
    const { getCrmContact } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const linkTarget = await seedUser(client);
    const org = await createOrganization(adminId, { name: "CRM Org", slug: `crm-${crypto.randomUUID()}` }, ownerId);

    const c1 = await createCrmContact(adminId, org.id, { firstName: "A", lastName: "One" });
    const c2 = await createCrmContact(adminId, org.id, { firstName: "B", lastName: "Two" });
    assert.ok(c1.kind === "ok" && c2.kind === "ok");

    const link1 = await linkCrmContactUser(adminId, org.id, c1.id, linkTarget);
    assert.equal(link1.kind, "ok");
    const contact1 = await getCrmContact(org.id, c1.id);
    assert.equal(contact1?.linkedUserId, linkTarget);

    const link2 = await linkCrmContactUser(adminId, org.id, c2.id, linkTarget);
    assert.equal(link2.kind, "conflict");

    await cleanup(client, [org.id], [adminId, ownerId, linkTarget]);
  });
});

test("linkCrmContactUser IDOR: a contact in organization B cannot be linked by supplying organization A's id", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, linkCrmContactUser } = await import("../../src/server/services/crm");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const linkTarget = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `crm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `crm-b-${crypto.randomUUID()}` }, ownerBId);

    const contactB = await createCrmContact(adminId, orgB.id, { firstName: "B", lastName: "Contact" });
    assert.ok(contactB.kind === "ok");

    // Attacker in org A supplies org A's id while targeting org B's contact.
    const result = await linkCrmContactUser(adminId, orgA.id, contactB.id, linkTarget);
    assert.equal(result.kind, "not_found");

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId, linkTarget]);
  });
});

test("assignCrmContact: succeeds for an ACTIVE organization member, denied for a non-member (invalid/cross-org assignee)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { createCrmContact, assignCrmContact } = await import("../../src/server/services/crm");
    const { getCrmContact } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const staffId = await seedUser(client);
    const outsiderId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "CRM Org", slug: `crm-${crypto.randomUUID()}` }, ownerId);
    await addOrganizationMember(adminId, org.id, staffId, "STAFF");

    const contact = await createCrmContact(adminId, org.id, { firstName: "A", lastName: "One" });
    assert.ok(contact.kind === "ok");

    const ok = await assignCrmContact(adminId, org.id, contact.id, staffId);
    assert.equal(ok.kind, "ok");
    assert.equal((await getCrmContact(org.id, contact.id))?.assignedToUserId, staffId);

    const denied = await assignCrmContact(adminId, org.id, contact.id, outsiderId);
    assert.equal(denied.kind, "invalid_assignee");

    await cleanup(client, [org.id], [adminId, ownerId, staffId, outsiderId]);
  });
});

test("getCrmContact IDOR: organization A cannot read organization B's contact by id", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact } = await import("../../src/server/services/crm");
    const { getCrmContact } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `crm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `crm-b-${crypto.randomUUID()}` }, ownerBId);

    const contactB = await createCrmContact(adminId, orgB.id, { firstName: "B", lastName: "Contact" });
    assert.ok(contactB.kind === "ok");

    assert.equal(await getCrmContact(orgA.id, contactB.id), undefined);
    assert.notEqual(await getCrmContact(orgB.id, contactB.id), undefined);

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("updateCrmContact / archiveCrmContact IDOR: organization A cannot mutate organization B's contact", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, updateCrmContact, archiveCrmContact } = await import("../../src/server/services/crm");
    const { getCrmContact } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `crm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `crm-b-${crypto.randomUUID()}` }, ownerBId);

    const contactB = await createCrmContact(adminId, orgB.id, { firstName: "B", lastName: "Contact" });
    assert.ok(contactB.kind === "ok");

    const updateResult = await updateCrmContact(adminId, orgA.id, contactB.id, { firstName: "Hacked" });
    assert.equal(updateResult.kind, "not_found");
    const archiveResult = await archiveCrmContact(adminId, orgA.id, contactB.id);
    assert.equal(archiveResult.kind, "not_found");

    const stillOriginal = await getCrmContact(orgB.id, contactB.id);
    assert.equal(stillOriginal?.firstName, "B");
    assert.equal(stillOriginal?.status, "ACTIVE");

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("CRM tags: create, attach, detach, and cross-organization tag attachment is denied", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, createCrmTag, attachCrmContactTag, detachCrmContactTag } = await import("../../src/server/services/crm");
    const { getContactTags } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `crm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `crm-b-${crypto.randomUUID()}` }, ownerBId);

    const contactA = await createCrmContact(adminId, orgA.id, { firstName: "A", lastName: "Contact" });
    assert.ok(contactA.kind === "ok");
    const tagA = await createCrmTag(adminId, orgA.id, "Prospect");
    const tagB = await createCrmTag(adminId, orgB.id, "Prospect");
    assert.ok(tagA.kind === "ok" && tagB.kind === "ok");

    const attach = await attachCrmContactTag(adminId, orgA.id, contactA.id, tagA.id);
    assert.equal(attach.kind, "ok");
    assert.deepEqual((await getContactTags(contactA.id)).map((t) => t.id), [tagA.id]);

    // org B's tag cannot be attached to org A's contact even though the caller supplies orgA.id as scope.
    const crossOrgAttach = await attachCrmContactTag(adminId, orgA.id, contactA.id, tagB.id);
    assert.equal(crossOrgAttach.kind, "not_found");

    const detach = await detachCrmContactTag(adminId, orgA.id, contactA.id, tagA.id);
    assert.equal(detach.kind, "ok");
    assert.equal((await getContactTags(contactA.id)).length, 0);

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("CRM notes: authorUserId always comes from the actor argument, never overridable, and notes persist through archive", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, addCrmContactNote, archiveCrmContact } = await import("../../src/server/services/crm");
    const { getContactNotes, getContactActivity } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "CRM Org", slug: `crm-${crypto.randomUUID()}` }, ownerId);

    const contact = await createCrmContact(adminId, org.id, { firstName: "A", lastName: "One" });
    assert.ok(contact.kind === "ok");

    const note = await addCrmContactNote(ownerId, org.id, contact.id, "Called the lead.");
    assert.equal(note.kind, "ok");
    const notesBefore = await getContactNotes(contact.id);
    assert.equal(notesBefore.items[0]?.authorUserId, ownerId);
    assert.equal(notesBefore.items[0]?.body, "Called the lead.");

    await archiveCrmContact(adminId, org.id, contact.id);
    const notesAfter = await getContactNotes(contact.id);
    assert.equal(notesAfter.total, 1);
    const activityAfter = await getContactActivity(contact.id);
    assert.ok(activityAfter.items.some((a) => a.type === "NOTE_ADDED"));
    assert.ok(activityAfter.items.some((a) => a.type === "CONTACT_ARCHIVED"));

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("Pipelines/stages: create, move a contact to a valid stage, and cross-organization stage movement is denied", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, createCrmPipeline, createCrmPipelineStage, moveCrmContactStage } = await import("../../src/server/services/crm");
    const { getCrmContact } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `crm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `crm-b-${crypto.randomUUID()}` }, ownerBId);

    const pipelineA = await createCrmPipeline(adminId, orgA.id, "Sales");
    const pipelineB = await createCrmPipeline(adminId, orgB.id, "Sales");
    assert.ok(pipelineA.kind === "ok" && pipelineB.kind === "ok");
    const stageA = await createCrmPipelineStage(adminId, orgA.id, pipelineA.id, "New", 0);
    const stageB = await createCrmPipelineStage(adminId, orgB.id, pipelineB.id, "New", 0);
    assert.ok(stageA.kind === "ok" && stageB.kind === "ok");

    const contactA = await createCrmContact(adminId, orgA.id, { firstName: "A", lastName: "Contact" });
    assert.ok(contactA.kind === "ok");

    const moveOk = await moveCrmContactStage(adminId, orgA.id, contactA.id, stageA.id);
    assert.equal(moveOk.kind, "ok");
    assert.equal((await getCrmContact(orgA.id, contactA.id))?.currentStageId, stageA.id);

    // org B's stage cannot be applied to org A's contact — cross-organization/cross-pipeline denied.
    const moveDenied = await moveCrmContactStage(adminId, orgA.id, contactA.id, stageB.id);
    assert.equal(moveDenied.kind, "invalid_stage");
    assert.equal((await getCrmContact(orgA.id, contactA.id))?.currentStageId, stageA.id);

    // creating a pipeline stage under a foreign organization's pipeline id is rejected.
    const foreignStage = await createCrmPipelineStage(adminId, orgA.id, pipelineB.id, "Hijacked", 0);
    assert.equal(foreignStage.kind, "not_found");

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("DB rejects a crm_contact row whose current_stage_id belongs to a different organization (composite FK)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmPipeline, createCrmPipelineStage } = await import("../../src/server/services/crm");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `crm-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `crm-b-${crypto.randomUUID()}` }, ownerBId);

    const pipelineB = await createCrmPipeline(adminId, orgB.id, "Sales");
    assert.ok(pipelineB.kind === "ok");
    const stageB = await createCrmPipelineStage(adminId, orgB.id, pipelineB.id, "New", 0);
    assert.ok(stageB.kind === "ok");

    await assert.rejects(
      client.query(
        `insert into crm_contact (id, organization_id, first_name, last_name, current_stage_id, created_by_user_id, created_at, updated_at)
         values ($1, $2, 'X', 'Y', $3, $4, now(), now())`,
        [crypto.randomUUID(), orgA.id, stageB.id, adminId],
      ),
      /foreign key constraint|violates/i,
    );

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("DB rejects a crm_contact with an unsupported status, and allows at most one linked user per organization", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const linkTarget = await seedUser(client);
    const org = await createOrganization(adminId, { name: "CRM Org", slug: `crm-${crypto.randomUUID()}` }, ownerId);

    await assert.rejects(
      client.query(
        `insert into crm_contact (id, organization_id, first_name, last_name, status, created_by_user_id, created_at, updated_at)
         values ($1, $2, 'X', 'Y', 'BOGUS', $3, now(), now())`,
        [crypto.randomUUID(), org.id, adminId],
      ),
      /check constraint|violates/i,
    );

    const id1 = crypto.randomUUID();
    await client.query(
      `insert into crm_contact (id, organization_id, first_name, last_name, linked_user_id, created_by_user_id, created_at, updated_at)
       values ($1, $2, 'X', 'Y', $3, $4, now(), now())`,
      [id1, org.id, linkTarget, adminId],
    );
    await assert.rejects(
      client.query(
        `insert into crm_contact (id, organization_id, first_name, last_name, linked_user_id, created_by_user_id, created_at, updated_at)
         values ($1, $2, 'A', 'B', $3, $4, now(), now())`,
        [crypto.randomUUID(), org.id, linkTarget, adminId],
      ),
      /duplicate key|unique/i,
    );

    await cleanup(client, [org.id], [adminId, ownerId, linkTarget]);
  });
});

test("searchCrmContacts: paginates and filters by status, scoped to a single organization", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCrmContact, archiveCrmContact } = await import("../../src/server/services/crm");
    const { searchCrmContacts } = await import("../../src/server/queries/crm");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "CRM Org", slug: `crm-${crypto.randomUUID()}` }, ownerId);

    const created: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const c = await createCrmContact(adminId, org.id, { firstName: `Contact${i}`, lastName: "Test" });
      assert.ok(c.kind === "ok");
      created.push(c.id);
    }
    await archiveCrmContact(adminId, org.id, created[0]);

    const page1 = await searchCrmContacts({ organizationId: org.id, page: 1, pageSize: 25 });
    assert.equal(page1.total, 12);

    const activeOnly = await searchCrmContacts({ organizationId: org.id, status: "ACTIVE" });
    assert.equal(activeOnly.total, 11);

    const paged = await searchCrmContacts({ organizationId: org.id, page: 1, pageSize: 10 });
    assert.equal(paged.items.length, 10);
    assert.equal(paged.totalPages, 2);

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});
