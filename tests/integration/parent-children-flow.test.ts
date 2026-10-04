import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";

const url =
  process.env.TEST_DATABASE_URL ??
  (process.env.NODE_ENV !== "production"
    ? "postgresql://anei:anei@127.0.0.1:5432/anei"
    : undefined);

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

async function seedUserWithPersona(
  client: Client,
  persona: "PARENT" | "STUDENT" | "TEACHER",
  email?: string
) {
  const userId = crypto.randomUUID();
  const userEmail = email ?? `parent-flow-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test Persona User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, userEmail]
  );
  await client.query(
    `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
     values ($1, $2, $3, 'ACTIVE', true, now(), now())`,
    [crypto.randomUUID(), userId, persona]
  );
  return { userId, email: userEmail };
}

async function cleanupUsers(client: Client, userIds: string[]) {
  await client.query(
    "delete from audit_logs where actor_user_id = any($1)",
    [userIds]
  );
  await client.query(
    "delete from parent_student_link where parent_user_id = any($1) or student_user_id = any($1)",
    [userIds]
  );
  await client.query(
    "delete from persona_membership where user_id = any($1)",
    [userIds]
  );
  await client.query(
    "delete from user_profile where user_id = any($1)",
    [userIds]
  );
  for (const userId of userIds) {
    await client.query('delete from "user" where id = $1', [userId]);
  }
}

test("parent-children-flow: parent creates a new child and active relationship link", async () => {
  await withClient(async (client) => {
    const parent = await seedUserWithPersona(client, "PARENT");
    const childUserId = crypto.randomUUID();
    const childEmail = `enfant.test-${childUserId}@famille.anei.local`;
    const linkId = crypto.randomUUID();

    try {
      // 1. Create child user
      await client.query(
        `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
         values ($1, $2, $3, true, 'USER', 'learner', now(), now())`,
        [childUserId, "Adam Cherni", childEmail]
      );

      // 2. Create child profile with PPS info
      await client.query(
        `insert into user_profile (id, user_id, first_name, last_name, institution_name, education_level, created_at, updated_at)
         values ($1, $2, 'Adam', 'Cherni', 'École Pasteur', 'CE2', now(), now())`,
        [crypto.randomUUID(), childUserId]
      );

      // 3. Create child STUDENT persona
      await client.query(
        `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
         values ($1, $2, 'STUDENT', 'ACTIVE', true, now(), now())`,
        [crypto.randomUUID(), childUserId]
      );

      // 4. Link child to parent
      await client.query(
        `insert into parent_student_link (id, parent_user_id, student_user_id, relationship_type, status, created_by, created_at, updated_at)
         values ($1, $2, $3, 'FATHER', 'ACTIVE', $2, now(), now())`,
        [linkId, parent.userId, childUserId]
      );

      // Verification: Active link exists
      const { rows: links } = await client.query(
        `select * from parent_student_link where id = $1 and status = 'ACTIVE'`,
        [linkId]
      );
      assert.equal(links.length, 1);
      assert.equal(links[0].parent_user_id, parent.userId);
      assert.equal(links[0].student_user_id, childUserId);
      assert.equal(links[0].relationship_type, "FATHER");

      // 5. Revoke link (simulate DELETE /api/parent/children/[id])
      await client.query(
        `update parent_student_link set status = 'REVOKED', updated_at = now() where id = $1`,
        [linkId]
      );

      const { rows: revokedLinks } = await client.query(
        `select * from parent_student_link where id = $1`,
        [linkId]
      );
      assert.equal(revokedLinks[0].status, "REVOKED");
    } finally {
      await cleanupUsers(client, [parent.userId, childUserId]);
    }
  });
});

test("parent-children-flow: parent links an existing student by email", async () => {
  await withClient(async (client) => {
    const parent = await seedUserWithPersona(client, "PARENT");
    const student = await seedUserWithPersona(client, "STUDENT");
    const linkId = crypto.randomUUID();

    try {
      await client.query(
        `insert into parent_student_link (id, parent_user_id, student_user_id, relationship_type, status, created_by, created_at, updated_at)
         values ($1, $2, $3, 'MOTHER', 'ACTIVE', $2, now(), now())`,
        [linkId, parent.userId, student.userId]
      );

      const { rows: links } = await client.query(
        `select * from parent_student_link where id = $1 and status = 'ACTIVE'`,
        [linkId]
      );
      assert.equal(links.length, 1);
      assert.equal(links[0].relationship_type, "MOTHER");
    } finally {
      await cleanupUsers(client, [parent.userId, student.userId]);
    }
  });
});
