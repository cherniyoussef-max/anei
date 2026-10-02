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

async function seedUser(client: Client, name = "Test User") {
  const userId = crypto.randomUUID();
  const email = `care-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, $2, $3, true, 'USER', 'learner', now(), now())`,
    [userId, name, email],
  );
  return userId;
}

async function seedUserWithPersona(
  client: Client,
  persona: "PARENT" | "STUDENT" | "SPECIALIST",
  status: "ACTIVE" | "PENDING_REVIEW" = "ACTIVE",
  name = "Test User",
) {
  const userId = await seedUser(client, name);
  await client.query(
    `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
     values ($1, $2, $3, $4, true, now(), now())`,
    [crypto.randomUUID(), userId, persona, status],
  );
  return userId;
}

async function seedParentStudentLink(client: Client, parentId: string, studentId: string) {
  const linkId = crypto.randomUUID();
  await client.query(
    `insert into parent_student_link (id, parent_user_id, student_user_id, relationship_type, status, created_by, created_at, updated_at)
     values ($1, $2, $3, 'MOTHER', 'ACTIVE', $4, now(), now())`,
    [linkId, parentId, studentId, parentId],
  );
  return linkId;
}

async function cleanupUsers(client: Client, userIds: string[]) {
  if (userIds.length === 0) return;
  await client.query(
    `delete from care_conversation_participant where user_id = any($1)`,
    [userIds],
  );
  await client.query(
    `delete from care_conversation where specialist_user_id = any($1) or student_user_id = any($1)`,
    [userIds],
  );
  await client.query(
    `delete from specialist_student_assignment where specialist_user_id = any($1) or student_user_id = any($1) or requested_by_user_id = any($1) or created_by = any($1)`,
    [userIds],
  );
  await client.query(
    `delete from parent_student_link where parent_user_id = any($1) or student_user_id = any($1) or created_by = any($1)`,
    [userIds],
  );
  await client.query(
    `delete from notifications where user_id = any($1)`,
    [userIds],
  );
  await client.query(
    `delete from audit_logs where actor_user_id = any($1)`,
    [userIds],
  );
  await client.query(
    `delete from persona_membership where user_id = any($1)`,
    [userIds],
  );
  await client.query(
    `delete from "user" where id = any($1)`,
    [userIds],
  );
}

test(
  "requestCareRelationship: validates consent, parent link, and active specialist persona",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const { requestCareRelationship } = await import(
        "../../src/server/services/care-relationships"
      );

      const parentId = await seedUserWithPersona(client, "PARENT");
      const unlinkedChildId = await seedUserWithPersona(client, "STUDENT");
      const linkedChildId = await seedUserWithPersona(client, "STUDENT");
      await seedParentStudentLink(client, parentId, linkedChildId);

      const pendingSpecialistId = await seedUserWithPersona(client, "SPECIALIST", "PENDING_REVIEW");
      const activeSpecialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE");

      const allUsers = [
        parentId,
        unlinkedChildId,
        linkedChildId,
        pendingSpecialistId,
        activeSpecialistId,
      ];

      // 1. Consent required
      const noConsent = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: linkedChildId,
        specialistUserId: activeSpecialistId,
        consentAccepted: false,
      });
      assert.equal(noConsent.kind, "consent_required");

      // 2. Unlinked child rejected (zero IDOR)
      const unlinked = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: unlinkedChildId,
        specialistUserId: activeSpecialistId,
        consentAccepted: true,
      });
      assert.equal(unlinked.kind, "forbidden_student");

      // 3. Specialist in PENDING_REVIEW rejected
      const pendingSpec = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: linkedChildId,
        specialistUserId: pendingSpecialistId,
        consentAccepted: true,
      });
      assert.equal(pendingSpec.kind, "specialist_not_active");

      // 4. Valid request succeeds
      const valid = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: linkedChildId,
        specialistUserId: activeSpecialistId,
        requestMessage: "Demande de suivi pour les difficultés d'élocution.",
        consentAccepted: true,
        consentVersion: "v1.0",
      });
      assert.equal(valid.kind, "ok");

      // Verify row state
      const row = await client.query(
        `select status, requested_by_user_id, request_message, consent_version, consent_accepted_at
         from specialist_student_assignment where id = $1`,
        [valid.id],
      );
      assert.equal(row.rows[0]?.status, "PENDING");
      assert.equal(row.rows[0]?.requested_by_user_id, parentId);
      assert.equal(row.rows[0]?.consent_version, "v1.0");
      assert.ok(row.rows[0]?.consent_accepted_at);

      // Verify specialist notification contains NO child clinical details
      const notif = await client.query(
        `select title, body from notifications where user_id = $1 order by created_at desc limit 1`,
        [activeSpecialistId],
      );
      assert.equal(notif.rows[0]?.title, "Nouvelle demande de suivi");
      assert.ok(!notif.rows[0]?.body.includes("élocution"));

      // 5. Duplicate request while PENDING rejected
      const dup = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: linkedChildId,
        specialistUserId: activeSpecialistId,
        consentAccepted: true,
      });
      assert.equal(dup.kind, "already_exists");

      await cleanupUsers(client, allUsers);
    });
  },
);

test(
  "acceptCareRelationship: specialist accepts pending request, creates conversation and participants",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const { requestCareRelationship, acceptCareRelationship } = await import(
        "../../src/server/services/care-relationships"
      );

      const parentId = await seedUserWithPersona(client, "PARENT");
      const studentId = await seedUserWithPersona(client, "STUDENT");
      await seedParentStudentLink(client, parentId, studentId);

      const specialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE");
      const otherSpecialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE");

      const allUsers = [parentId, studentId, specialistId, otherSpecialistId];

      const req = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: studentId,
        specialistUserId: specialistId,
        consentAccepted: true,
      });
      assert.equal(req.kind, "ok");

      // Wrong specialist cannot accept
      const wrong = await acceptCareRelationship(otherSpecialistId, req.id);
      assert.equal(wrong.kind, "forbidden");

      // Assigned specialist accepts
      const accepted = await acceptCareRelationship(specialistId, req.id);
      assert.equal(accepted.kind, "ok");
      assert.ok(accepted.conversationId);

      // Verify assignment row is ACTIVE
      const assignRow = await client.query(
        `select status, start_date from specialist_student_assignment where id = $1`,
        [req.id],
      );
      assert.equal(assignRow.rows[0]?.status, "ACTIVE");
      assert.ok(assignRow.rows[0]?.start_date);

      // Verify care_conversation created with status OPEN
      const convRow = await client.query(
        `select id, status, specialist_user_id, student_user_id from care_conversation where id = $1`,
        [accepted.conversationId],
      );
      assert.equal(convRow.rows[0]?.status, "OPEN");
      assert.equal(convRow.rows[0]?.specialist_user_id, specialistId);
      assert.equal(convRow.rows[0]?.student_user_id, studentId);

      // Verify participants: both specialist and linked parent
      const parts = await client.query(
        `select user_id, role from care_conversation_participant where conversation_id = $1 order by role`,
        [accepted.conversationId],
      );
      assert.equal(parts.rows.length, 2);
      const parentPart = parts.rows.find((p) => p.role === "PARENT");
      const specPart = parts.rows.find((p) => p.role === "SPECIALIST");
      assert.equal(parentPart?.user_id, parentId);
      assert.equal(specPart?.user_id, specialistId);

      // Double accept fails
      const doubleAccept = await acceptCareRelationship(specialistId, req.id);
      assert.equal(doubleAccept.kind, "invalid_status");

      await cleanupUsers(client, allUsers);
    });
  },
);

test(
  "declineCareRelationship: specialist declines pending request with reason",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const { requestCareRelationship, declineCareRelationship } = await import(
        "../../src/server/services/care-relationships"
      );

      const parentId = await seedUserWithPersona(client, "PARENT");
      const studentId = await seedUserWithPersona(client, "STUDENT");
      await seedParentStudentLink(client, parentId, studentId);
      const specialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE");

      const allUsers = [parentId, studentId, specialistId];

      const req = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: studentId,
        specialistUserId: specialistId,
        consentAccepted: true,
      });
      assert.equal(req.kind, "ok");

      const declined = await declineCareRelationship(
        specialistId,
        req.id,
        "Capacité d'accueil atteinte pour ce trimestre",
      );
      assert.equal(declined.kind, "ok");

      const row = await client.query(
        `select status, decline_reason from specialist_student_assignment where id = $1`,
        [req.id],
      );
      assert.equal(row.rows[0]?.status, "DECLINED");
      assert.equal(
        row.rows[0]?.decline_reason,
        "Capacité d'accueil atteinte pour ce trimestre",
      );

      // Parent was notified
      const notif = await client.query(
        `select title from notifications where user_id = $1 order by created_at desc limit 1`,
        [parentId],
      );
      assert.equal(notif.rows[0]?.title, "Demande de suivi non retenue");

      await cleanupUsers(client, allUsers);
    });
  },
);

test(
  "endCareRelationship: terminates active care and sets conversation to READ_ONLY",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const {
        requestCareRelationship,
        acceptCareRelationship,
        endCareRelationship,
      } = await import("../../src/server/services/care-relationships");

      const parentId = await seedUserWithPersona(client, "PARENT");
      const studentId = await seedUserWithPersona(client, "STUDENT");
      await seedParentStudentLink(client, parentId, studentId);
      const specialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE");
      const strangerId = await seedUser(client);

      const allUsers = [parentId, studentId, specialistId, strangerId];

      const req = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: studentId,
        specialistUserId: specialistId,
        consentAccepted: true,
      });
      assert.equal(req.kind, "ok");

      const accepted = await acceptCareRelationship(specialistId, req.id);
      assert.equal(accepted.kind, "ok");

      // Stranger cannot end relationship
      const unauthorizedEnd = await endCareRelationship(strangerId, req.id);
      assert.equal(unauthorizedEnd.kind, "forbidden");

      // Parent ends relationship
      const ended = await endCareRelationship(
        parentId,
        req.id,
        "Fin de parcours éducatif",
      );
      assert.equal(ended.kind, "ok");

      // Verify assignment is ENDED
      const assign = await client.query(
        `select status, ended_by_user_id, end_reason, end_date from specialist_student_assignment where id = $1`,
        [req.id],
      );
      assert.equal(assign.rows[0]?.status, "ENDED");
      assert.equal(assign.rows[0]?.ended_by_user_id, parentId);
      assert.equal(assign.rows[0]?.end_reason, "Fin de parcours éducatif");
      assert.ok(assign.rows[0]?.end_date);

      // Verify conversation transitioned to READ_ONLY
      const conv = await client.query(
        `select status from care_conversation where care_relationship_id = $1`,
        [req.id],
      );
      assert.equal(conv.rows[0]?.status, "READ_ONLY");

      // Re-ending an ended relationship fails
      const alreadyEnded = await endCareRelationship(parentId, req.id);
      assert.equal(alreadyEnded.kind, "invalid_status");

      await cleanupUsers(client, allUsers);
    });
  },
);

test.after(async () => {
  if (url) {
    const { pool } = await import("../../src/server/db");
    await pool.end().catch(() => undefined);
  }
});
