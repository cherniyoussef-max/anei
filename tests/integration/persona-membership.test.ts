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

async function seedUser(client: Client, profileType = "learner") {
  const userId = crypto.randomUUID();
  const email = `persona-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', $3, now(), now())`,
    [userId, email, profileType],
  );
  return userId;
}

async function cleanup(client: Client, userIds: string[]) {
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

test("ensurePrimaryPersonaMembership: STUDENT/PARENT start ACTIVE, professional personas start PENDING_REVIEW", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { ensurePrimaryPersonaMembership } = await import("../../src/server/services/personas");

    const learnerId = await seedUser(client, "learner");
    const teacherId = await seedUser(client, "teacher");
    const parentId = await seedUser(client, "parent");

    await ensurePrimaryPersonaMembership(learnerId, "learner");
    await ensurePrimaryPersonaMembership(teacherId, "teacher");
    await ensurePrimaryPersonaMembership(parentId, "parent");

    const rows = await client.query(
      `select user_id, persona, status, is_primary from persona_membership where user_id = any($1)`,
      [[learnerId, teacherId, parentId]],
    );
    const byUser = Object.fromEntries(rows.rows.map((r) => [r.user_id, r]));
    assert.equal(byUser[learnerId].persona, "STUDENT");
    assert.equal(byUser[learnerId].status, "ACTIVE");
    assert.equal(byUser[learnerId].is_primary, true);
    assert.equal(byUser[teacherId].persona, "TEACHER");
    assert.equal(byUser[teacherId].status, "PENDING_REVIEW");
    assert.equal(byUser[parentId].persona, "PARENT");
    assert.equal(byUser[parentId].status, "ACTIVE");

    await cleanup(client, [learnerId, teacherId, parentId]);
  });
});

test("ensurePrimaryPersonaMembership is idempotent (retries don't duplicate or create a second primary)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { ensurePrimaryPersonaMembership } = await import("../../src/server/services/personas");

    const userId = await seedUser(client, "avs");
    await ensurePrimaryPersonaMembership(userId, "avs");
    await ensurePrimaryPersonaMembership(userId, "avs");
    await ensurePrimaryPersonaMembership(userId, "avs");

    const rows = await client.query(`select count(*)::int as count from persona_membership where user_id = $1`, [userId]);
    assert.equal(rows.rows[0].count, 1);

    await cleanup(client, [userId]);
  });
});

test("DB enforces at most one primary persona per user", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await seedUser(client, "learner");
    await client.query(
      `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
       values ($1, $2, 'STUDENT', 'ACTIVE', true, now(), now())`,
      [crypto.randomUUID(), userId],
    );
    await assert.rejects(
      client.query(
        `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
         values ($1, $2, 'TEACHER', 'PENDING_REVIEW', true, now(), now())`,
        [crypto.randomUUID(), userId],
      ),
      /duplicate key|unique/i,
    );
    await cleanup(client, [userId]);
  });
});

test("DB rejects an unsupported persona or status value", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await seedUser(client, "learner");
    await assert.rejects(
      client.query(
        `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
         values ($1, $2, 'BOGUS', 'ACTIVE', false, now(), now())`,
        [crypto.randomUUID(), userId],
      ),
      /check constraint|violates/i,
    );
    await cleanup(client, [userId]);
  });
});

test("adminSetPersonaStatus updates status and writes an audit row", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { ensurePrimaryPersonaMembership, adminSetPersonaStatus } = await import("../../src/server/services/personas");

    const adminId = await seedUser(client, "learner");
    const teacherId = await seedUser(client, "teacher");
    await ensurePrimaryPersonaMembership(teacherId, "teacher");

    const result = await adminSetPersonaStatus(adminId, teacherId, "TEACHER", "ACTIVE");
    assert.equal(result.kind, "ok");

    const row = await client.query(`select status from persona_membership where user_id = $1 and persona = 'TEACHER'`, [teacherId]);
    assert.equal(row.rows[0].status, "ACTIVE");

    const audit = await client.query(
      `select action, metadata from audit_logs where entity_type = 'persona_membership' and entity_id = $1 order by created_at desc limit 1`,
      [teacherId],
    );
    assert.equal(audit.rowCount, 1);
    assert.equal(audit.rows[0].action, "persona.status.active");

    await cleanup(client, [adminId, teacherId]);
  });
});

test("adminSetPrimaryPersona reassigns primary to a different existing persona", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { ensurePrimaryPersonaMembership, adminSetPrimaryPersona } = await import("../../src/server/services/personas");

    const adminId = await seedUser(client, "learner");
    const userId = await seedUser(client, "learner");
    await ensurePrimaryPersonaMembership(userId, "learner");
    await client.query(
      `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
       values ($1, $2, 'PARENT', 'ACTIVE', false, now(), now())`,
      [crypto.randomUUID(), userId],
    );

    const result = await adminSetPrimaryPersona(adminId, userId, "PARENT");
    assert.equal(result.kind, "ok");

    const rows = await client.query(`select persona, is_primary from persona_membership where user_id = $1`, [userId]);
    const primaries = rows.rows.filter((r) => r.is_primary);
    assert.equal(primaries.length, 1);
    assert.equal(primaries[0].persona, "PARENT");

    await cleanup(client, [adminId, userId]);
  });
});

test("getUserPersonas / hasActivePersona reflect DB state, not client input", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { ensurePrimaryPersonaMembership } = await import("../../src/server/services/personas");
    const { hasActivePersona, getPrimaryPersona } = await import("../../src/server/queries/personas");

    const teacherId = await seedUser(client, "teacher");
    await ensurePrimaryPersonaMembership(teacherId, "teacher");

    assert.equal(await hasActivePersona(teacherId, "TEACHER"), false); // PENDING_REVIEW, not ACTIVE
    const primary = await getPrimaryPersona(teacherId);
    assert.equal(primary?.persona, "TEACHER");
    assert.equal(primary?.status, "PENDING_REVIEW");

    await client.query(`update persona_membership set status = 'ACTIVE' where user_id = $1`, [teacherId]);
    assert.equal(await hasActivePersona(teacherId, "TEACHER"), true);

    await cleanup(client, [teacherId]);
  });
});
