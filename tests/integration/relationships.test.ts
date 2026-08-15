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
  const email = `rel-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

/**
 * Seeds a user with an ACTIVE persona_membership row for `persona`. The
 * create* relationship/assignment services require the counterparty to
 * actually hold the ACTIVE persona the row implies (see
 * `createParentStudentLink`), which raw-inserted test users don't get for
 * free — the better-auth `user.create.after` hook that normally grants one
 * isn't invoked by a direct SQL insert.
 */
async function seedUserWithPersona(client: Client, persona: "PARENT" | "STUDENT" | "AVS" | "SPECIALIST") {
  const userId = await seedUser(client);
  await client.query(
    `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
     values ($1, $2, $3, 'ACTIVE', true, now(), now())`,
    [crypto.randomUUID(), userId, persona],
  );
  return userId;
}

// parent_user_id/student_user_id/avs_user_id/specialist_user_id/created_by
// are all ON DELETE restrict (history is never destructively removed as a
// side effect of deleting a user) — tests must explicitly clear the
// relationship/assignment rows a seeded user participates in before
// deleting that user, rather than relying on cascade to do it.
async function cleanupUsers(client: Client, userIds: string[]) {
  await client.query('delete from parent_student_link where parent_user_id = any($1) or student_user_id = any($1) or created_by = any($1)', [userIds]);
  await client.query('delete from avs_student_assignment where avs_user_id = any($1) or student_user_id = any($1) or created_by = any($1)', [userIds]);
  await client.query('delete from specialist_student_assignment where specialist_user_id = any($1) or student_user_id = any($1) or created_by = any($1)', [userIds]);
  for (const userId of userIds) {
    await client.query('delete from "user" where id = $1', [userId]);
  }
}

test("createParentStudentLink creates a PENDING link and an audit row; parent has no access until ACTIVE", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createParentStudentLink } = await import("../../src/server/services/relationships");
    const { hasActiveParentLink } = await import("../../src/server/queries/relationships");

    const adminId = await seedUser(client);
    const parentId = await seedUserWithPersona(client, "PARENT");
    const studentId = await seedUserWithPersona(client, "STUDENT");

    const result = await createParentStudentLink(adminId, parentId, studentId, "MOTHER");
    assert.equal(result.kind, "ok");
    assert.equal(await hasActiveParentLink(parentId, studentId), false);

    const audit = await client.query(`select action from audit_logs where entity_type = 'parent_student_link' and entity_id = $1`, [result.id]);
    assert.equal(audit.rows[0]?.action, "relationship.parentLink.create");

    await cleanupUsers(client, [parentId, studentId, adminId]);
  });
});

test("setParentStudentLinkStatus to ACTIVE grants access; IDOR — parent cannot see an unrelated student", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createParentStudentLink, setParentStudentLinkStatus } = await import("../../src/server/services/relationships");
    const { hasActiveParentLink } = await import("../../src/server/queries/relationships");

    const adminId = await seedUser(client);
    const parentId = await seedUserWithPersona(client, "PARENT");
    const studentAId = await seedUserWithPersona(client, "STUDENT");
    const studentBId = await seedUserWithPersona(client, "STUDENT");

    const link = await createParentStudentLink(adminId, parentId, studentAId, "GUARDIAN");
    assert.equal(link.kind, "ok");
    await setParentStudentLinkStatus(adminId, link.id, "ACTIVE");

    assert.equal(await hasActiveParentLink(parentId, studentAId), true);
    // IDOR: the same parent must not be granted access to a different student.
    assert.equal(await hasActiveParentLink(parentId, studentBId), false);

    await cleanupUsers(client, [parentId, studentAId, studentBId, adminId]);
  });
});

test("AVS assignment: IDOR — an AVS assigned to student A is denied access to student B", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createAvsAssignment } = await import("../../src/server/services/relationships");
    const { hasActiveAvsAssignment } = await import("../../src/server/queries/relationships");

    const adminId = await seedUser(client);
    const avsId = await seedUserWithPersona(client, "AVS");
    const studentAId = await seedUserWithPersona(client, "STUDENT");
    const studentBId = await seedUserWithPersona(client, "STUDENT");

    await createAvsAssignment(adminId, avsId, studentAId);

    assert.equal(await hasActiveAvsAssignment(avsId, studentAId), true);
    assert.equal(await hasActiveAvsAssignment(avsId, studentBId), false);

    await cleanupUsers(client, [avsId, studentAId, studentBId, adminId]);
  });
});

test("endAvsAssignment ends the assignment without deleting history and revokes access", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createAvsAssignment, endAvsAssignment } = await import("../../src/server/services/relationships");
    const { hasActiveAvsAssignment } = await import("../../src/server/queries/relationships");

    const adminId = await seedUser(client);
    const avsId = await seedUserWithPersona(client, "AVS");
    const studentId = await seedUserWithPersona(client, "STUDENT");

    const created = await createAvsAssignment(adminId, avsId, studentId);
    assert.equal(created.kind, "ok");
    await endAvsAssignment(adminId, created.id);

    assert.equal(await hasActiveAvsAssignment(avsId, studentId), false);
    const row = await client.query(`select status from avs_student_assignment where id = $1`, [created.id]);
    assert.equal(row.rows[0].status, "ENDED");

    const audit = await client.query(`select action from audit_logs where entity_type = 'avs_student_assignment' and entity_id = $1 order by created_at desc limit 1`, [created.id]);
    assert.equal(audit.rows[0]?.action, "relationship.avsAssignment.end");

    await cleanupUsers(client, [avsId, studentId, adminId]);
  });
});

test("specialist assignment: IDOR — a specialist assigned to student A is denied access to student B", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createSpecialistAssignment } = await import("../../src/server/services/relationships");
    const { hasActiveSpecialistAssignment } = await import("../../src/server/queries/relationships");

    const adminId = await seedUser(client);
    const specialistId = await seedUserWithPersona(client, "SPECIALIST");
    const studentAId = await seedUserWithPersona(client, "STUDENT");
    const studentBId = await seedUserWithPersona(client, "STUDENT");

    await createSpecialistAssignment(adminId, specialistId, studentAId);

    assert.equal(await hasActiveSpecialistAssignment(specialistId, studentAId), true);
    assert.equal(await hasActiveSpecialistAssignment(specialistId, studentBId), false);

    await cleanupUsers(client, [specialistId, studentAId, studentBId, adminId]);
  });
});

test("DB rejects a self-referencing parent_student_link (parent cannot be their own student)", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await seedUser(client);
    await assert.rejects(
      client.query(
        `insert into parent_student_link (id, parent_user_id, student_user_id, relationship_type, status, created_by, created_at, updated_at)
         values ($1, $2, $2, 'OTHER', 'PENDING', $2, now(), now())`,
        [crypto.randomUUID(), userId],
      ),
      /check constraint|violates/i,
    );
    await cleanupUsers(client, [userId]);
  });
});

test("DB allows at most one ACTIVE avs_student_assignment per (avs, student), but permits historical ENDED rows", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createAvsAssignment, endAvsAssignment } = await import("../../src/server/services/relationships");

    const adminId = await seedUser(client);
    const avsId = await seedUserWithPersona(client, "AVS");
    const studentId = await seedUserWithPersona(client, "STUDENT");

    const first = await createAvsAssignment(adminId, avsId, studentId);
    assert.equal(first.kind, "ok");

    await assert.rejects(
      client.query(
        `insert into avs_student_assignment (id, avs_user_id, student_user_id, status, start_date, created_by, created_at, updated_at)
         values ($1, $2, $3, 'ACTIVE', now(), $4, now(), now())`,
        [crypto.randomUUID(), avsId, studentId, adminId],
      ),
      /duplicate key|unique/i,
    );

    await endAvsAssignment(adminId, first.id);
    const second = await createAvsAssignment(adminId, avsId, studentId);
    assert.equal(second.kind, "ok");
    assert.notEqual(second.id, first.id);

    const rows = await client.query(`select status from avs_student_assignment where avs_user_id = $1 and student_user_id = $2`, [avsId, studentId]);
    assert.equal(rows.rowCount, 2);

    await cleanupUsers(client, [avsId, studentId, adminId]);
  });
});

test("DB refuses to delete a student who still has relationship/assignment history (ON DELETE restrict, not cascade)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createParentStudentLink, createAvsAssignment, createSpecialistAssignment } = await import("../../src/server/services/relationships");

    const adminId = await seedUser(client);
    const parentId = await seedUserWithPersona(client, "PARENT");
    const avsId = await seedUserWithPersona(client, "AVS");
    const specialistId = await seedUserWithPersona(client, "SPECIALIST");
    const studentId = await seedUserWithPersona(client, "STUDENT");

    await createParentStudentLink(adminId, parentId, studentId, "MOTHER");
    await createAvsAssignment(adminId, avsId, studentId);
    await createSpecialistAssignment(adminId, specialistId, studentId);

    // Deleting the student would silently destroy history under CASCADE;
    // it must instead be rejected while any relationship/assignment row
    // (active or ended) still references them.
    await assert.rejects(client.query('delete from "user" where id = $1', [studentId]), /foreign key constraint|violates/i);
    // Same for the other participant in each table.
    await assert.rejects(client.query('delete from "user" where id = $1', [parentId]), /foreign key constraint|violates/i);
    await assert.rejects(client.query('delete from "user" where id = $1', [avsId]), /foreign key constraint|violates/i);
    await assert.rejects(client.query('delete from "user" where id = $1', [specialistId]), /foreign key constraint|violates/i);

    await cleanupUsers(client, [parentId, avsId, specialistId, studentId, adminId]);
  });
});

test("createParentStudentLink rejects a target who does not hold the ACTIVE persona the row implies", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createParentStudentLink } = await import("../../src/server/services/relationships");

    const adminId = await seedUser(client);
    const parentId = await seedUserWithPersona(client, "PARENT");
    const studentId = await seedUserWithPersona(client, "STUDENT");
    const nonParent = await seedUser(client); // no PARENT persona at all
    const nonStudent = await seedUserWithPersona(client, "AVS"); // wrong persona

    assert.equal((await createParentStudentLink(adminId, nonParent, studentId, "MOTHER")).kind, "invalid_persona");
    assert.equal((await createParentStudentLink(adminId, parentId, nonStudent, "MOTHER")).kind, "invalid_persona");

    const rows = await client.query("select 1 from parent_student_link where parent_user_id = any($1) or student_user_id = any($1)", [[nonParent, nonStudent]]);
    assert.equal(rows.rowCount, 0);

    await cleanupUsers(client, [parentId, studentId, nonParent, nonStudent, adminId]);
  });
});

test("createAvsAssignment and createSpecialistAssignment reject a target who does not hold the ACTIVE persona the row implies", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createAvsAssignment, createSpecialistAssignment } = await import("../../src/server/services/relationships");

    const adminId = await seedUser(client);
    const avsId = await seedUserWithPersona(client, "AVS");
    const specialistId = await seedUserWithPersona(client, "SPECIALIST");
    const studentId = await seedUserWithPersona(client, "STUDENT");
    const notAvs = await seedUserWithPersona(client, "PARENT");
    const notStudent = await seedUser(client);

    assert.equal((await createAvsAssignment(adminId, notAvs, studentId)).kind, "invalid_persona");
    assert.equal((await createAvsAssignment(adminId, avsId, notStudent)).kind, "invalid_persona");
    assert.equal((await createSpecialistAssignment(adminId, notAvs, studentId)).kind, "invalid_persona");
    assert.equal((await createSpecialistAssignment(adminId, specialistId, notStudent)).kind, "invalid_persona");

    await cleanupUsers(client, [avsId, specialistId, studentId, notAvs, notStudent, adminId]);
  });
});
