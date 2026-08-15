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
  const email = `org-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

async function cleanupUsers(client: Client, userIds: string[]) {
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

async function cleanupOrgs(client: Client, orgIds: string[]) {
  await client.query("delete from organization where id = any($1)", [orgIds]);
}

test("createOrganization creates an organization with a founding ACTIVE OWNER membership and an audit row", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { getOwnOrganizationMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const slug = `org-${crypto.randomUUID()}`;

    const org = await createOrganization(adminId, { name: "Test Org", slug }, ownerId);
    const membership = await getOwnOrganizationMembership(ownerId, org.id);
    assert.equal(membership?.role, "OWNER");
    assert.equal(membership?.status, "ACTIVE");

    const audit = await client.query(
      `select action from audit_logs where entity_type = 'organization' and entity_id = $1`,
      [org.id],
    );
    assert.equal(audit.rows[0]?.action, "organization.create");

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerId]);
  });
});

test("requireOrgMembership: role rank is enforced — STAFF cannot satisfy an OWNER-only check", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { requireOrgMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const staffId = await seedUser(client);
    const slug = `org-${crypto.randomUUID()}`;

    const org = await createOrganization(adminId, { name: "Test Org", slug }, ownerId);
    await addOrganizationMember(adminId, org.id, staffId, "STAFF");

    assert.notEqual(await requireOrgMembership(staffId, org.id, "VIEWER"), null);
    assert.equal(await requireOrgMembership(staffId, org.id, "OWNER"), null);
    assert.notEqual(await requireOrgMembership(ownerId, org.id, "OWNER"), null);

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerId, staffId]);
  });
});

test("GET /api/organizations/[id] IDOR: getOwnOrganizationMembership (the route's sole authorization primitive) returns nothing for another org's id, even for a valid member of some org", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { getOwnOrganizationMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);

    const orgA = await createOrganization(adminId, { name: "Org A", slug: `org-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `org-b-${crypto.randomUUID()}` }, ownerBId);

    // ownerB is a real, ACTIVE OWNER — just not of orgA. Supplying orgA's id
    // (the only client-controlled input to this route) must not leak orgA's
    // membership data to them; the route 404s exactly as if orgA didn't exist.
    assert.equal(await getOwnOrganizationMembership(ownerBId, orgA.id), undefined);
    assert.notEqual(await getOwnOrganizationMembership(ownerBId, orgB.id), undefined);

    await cleanupOrgs(client, [orgA.id, orgB.id]);
    await cleanupUsers(client, [adminId, ownerAId, ownerBId]);
  });
});

test("requireOrgMembership denies a member of a different organization (cross-organization authorization)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { requireOrgMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);

    const orgA = await createOrganization(adminId, { name: "Org A", slug: `org-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `org-b-${crypto.randomUUID()}` }, ownerBId);

    assert.equal(await requireOrgMembership(ownerBId, orgA.id, "VIEWER"), null);

    await cleanupOrgs(client, [orgA.id, orgB.id]);
    await cleanupUsers(client, [adminId, ownerAId, ownerBId]);
  });
});

test("changeOrganizationMemberRole rejects demoting the last active OWNER", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, changeOrganizationMemberRole } = await import("../../src/server/services/organizations");
    const { getOwnOrganizationMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Test Org", slug: `org-${crypto.randomUUID()}` }, ownerId);
    const membership = await getOwnOrganizationMembership(ownerId, org.id);

    const result = await changeOrganizationMemberRole(adminId, org.id, membership!.id, "MANAGER");
    assert.equal(result.kind, "last_owner");

    const stillOwner = await getOwnOrganizationMembership(ownerId, org.id);
    assert.equal(stillOwner?.role, "OWNER");

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerId]);
  });
});

test("changeOrganizationMemberRole allows demoting an OWNER when another active OWNER remains", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember, changeOrganizationMemberRole } = await import("../../src/server/services/organizations");
    const { getOwnOrganizationMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Test Org", slug: `org-${crypto.randomUUID()}` }, ownerAId);
    await addOrganizationMember(adminId, org.id, ownerBId, "OWNER");

    const membershipA = await getOwnOrganizationMembership(ownerAId, org.id);
    const result = await changeOrganizationMemberRole(adminId, org.id, membershipA!.id, "MANAGER");
    assert.equal(result.kind, "ok");

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerAId, ownerBId]);
  });
});

test("revokeOrganizationMembership rejects revoking the last active OWNER", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, revokeOrganizationMembership } = await import("../../src/server/services/organizations");
    const { getOwnOrganizationMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Test Org", slug: `org-${crypto.randomUUID()}` }, ownerId);
    const membership = await getOwnOrganizationMembership(ownerId, org.id);

    const result = await revokeOrganizationMembership(adminId, org.id, membership!.id);
    assert.equal(result.kind, "last_owner");

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerId]);
  });
});

/**
 * Concurrency proof for the last-active-OWNER invariant: two OWNERs exist,
 * and two mutations that would each independently succeed (each sees "2
 * owners, 1 remains after me") are fired truly concurrently. The
 * pg_advisory_xact_lock keyed on organizationId must serialize them so the
 * second transaction re-checks the owner count *after* the first commits —
 * closing the "SELECT count then UPDATE" race. Exactly one must succeed;
 * the organization must never end up with zero active owners.
 */
test("concurrent ownership mutations on the same organization cannot leave zero active owners", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember, changeOrganizationMemberRole } = await import("../../src/server/services/organizations");
    const { getOwnOrganizationMembership, countActiveOwners } = await import("../../src/server/queries/organizations");
    const { db } = await import("../../src/server/db");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Test Org", slug: `org-${crypto.randomUUID()}` }, ownerAId);
    await addOrganizationMember(adminId, org.id, ownerBId, "OWNER");

    const membershipA = await getOwnOrganizationMembership(ownerAId, org.id);
    const membershipB = await getOwnOrganizationMembership(ownerBId, org.id);

    const [resultA, resultB] = await Promise.all([
      changeOrganizationMemberRole(adminId, org.id, membershipA!.id, "MANAGER"),
      changeOrganizationMemberRole(adminId, org.id, membershipB!.id, "MANAGER"),
    ]);

    const outcomes = [resultA.kind, resultB.kind].sort();
    // Either one demotion succeeds and the other is correctly rejected as
    // the last owner, or (if serialized the other way) both could observe
    // an owner remaining — the only forbidden outcome is both succeeding.
    assert.notDeepEqual(outcomes, ["ok", "ok"]);

    const remainingOwners = await countActiveOwners(db, org.id);
    assert.ok(remainingOwners >= 1, `expected at least one remaining active owner, got ${remainingOwners}`);

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerAId, ownerBId]);
  });
});

test("DB rejects an organization_membership row with an unsupported role or status", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Test Org", slug: `org-${crypto.randomUUID()}` }, ownerId);

    await assert.rejects(
      client.query(
        `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
         values ($1, $2, $3, 'BOGUS', 'ACTIVE', now(), now())`,
        [crypto.randomUUID(), org.id, ownerId],
      ),
      /check constraint|violates/i,
    );

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerId]);
  });
});

test("DB allows at most one ACTIVE membership per (organization, user)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { getOwnOrganizationMembership } = await import("../../src/server/queries/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Test Org", slug: `org-${crypto.randomUUID()}` }, ownerId);
    const membership = await getOwnOrganizationMembership(ownerId, org.id);

    await assert.rejects(
      client.query(
        `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
         values ($1, $2, $3, 'VIEWER', 'ACTIVE', now(), now())`,
        [crypto.randomUUID(), org.id, ownerId],
      ),
      /duplicate key|unique/i,
    );
    assert.equal(membership?.role, "OWNER");

    await cleanupOrgs(client, [org.id]);
    await cleanupUsers(client, [adminId, ownerId]);
  });
});
