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
  const email = `care-msg-${userId}@example.test`;
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
  await client.query(`delete from care_message where sender_user_id = any($1)`, [userIds]);
  await client.query(`delete from care_conversation_participant where user_id = any($1)`, [userIds]);
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
  await client.query(`delete from notifications where user_id = any($1)`, [userIds]);
  await client.query(`delete from audit_logs where actor_user_id = any($1)`, [userIds]);
  await client.query(`delete from persona_membership where user_id = any($1)`, [userIds]);
  await client.query(`delete from "user" where id = any($1)`, [userIds]);
}

test(
  "sendCareMessage: enforces participant membership, saves plain text, dispatches generic notifications",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const {
        requestCareRelationship,
        acceptCareRelationship,
      } = await import("../../src/server/services/care-relationships");
      const { sendCareMessage } = await import(
        "../../src/server/services/care-messaging"
      );

      const parentId = await seedUserWithPersona(client, "PARENT");
      const studentId = await seedUserWithPersona(client, "STUDENT");
      await seedParentStudentLink(client, parentId, studentId);
      const specialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE");
      const intruderId = await seedUser(client);

      const allUsers = [parentId, studentId, specialistId, intruderId];

      const req = await requestCareRelationship({
        parentUserId: parentId,
        studentUserId: studentId,
        specialistUserId: specialistId,
        consentAccepted: true,
      });
      assert.equal(req.kind, "ok");
      if (req.kind !== "ok") throw new Error("Expected req.kind === ok");

      const accepted = await acceptCareRelationship(specialistId, req.id);
      assert.equal(accepted.kind, "ok");
      if (accepted.kind !== "ok") throw new Error("Expected accepted.kind === ok");
      const conversationId = accepted.conversationId;

      // 1. Non-participant cannot send message (zero IDOR)
      const intruderSend = await sendCareMessage({
        callerUserId: intruderId,
        conversationId,
        content: "Message non autorisé",
      });
      assert.equal(intruderSend.kind, "forbidden");

      // 2. Empty or invalid content rejected
      const emptySend = await sendCareMessage({
        callerUserId: specialistId,
        conversationId,
        content: "   ",
      });
      assert.equal(emptySend.kind, "invalid_content");

      // 3. Specialist sends valid message (HTML stripped)
      const specSend = await sendCareMessage({
        callerUserId: specialistId,
        conversationId,
        content: "<p>Bonjour, nous commençons le suivi <b>dès lundi</b>.</p>",
      });
      assert.equal(specSend.kind, "ok");
      if (specSend.kind !== "ok") throw new Error("Expected specSend.kind === ok");

      // Verify stored message is sanitized plain text
      const msgRow = await client.query(
        `select content, status, sender_user_id from care_message where id = $1`,
        [specSend.messageId],
      );
      assert.equal(
        msgRow.rows[0]?.content,
        "Bonjour, nous commençons le suivi dès lundi.",
      );
      assert.equal(msgRow.rows[0]?.status, "SENT");
      assert.equal(msgRow.rows[0]?.sender_user_id, specialistId);

      // Verify recipient (parent) received generic notification
      const parentNotif = await client.query(
        `select title, body from notifications where user_id = $1 order by created_at desc limit 1`,
        [parentId],
      );
      assert.equal(parentNotif.rows[0]?.title, "Nouveau message de suivi");
      assert.ok(
        !parentNotif.rows[0]?.body.includes("lundi"),
        "Notification must never include message content",
      );

      // 4. Parent replies
      const parentSend = await sendCareMessage({
        callerUserId: parentId,
        conversationId,
        content: "Parfait, nous serons présents.",
      });
      assert.equal(parentSend.kind, "ok");

      await cleanupUsers(client, allUsers);
    });
  },
);

test(
  "getCareMessages & markCareConversationRead: verifies access, retrieves messages, updates read status",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const {
        requestCareRelationship,
        acceptCareRelationship,
      } = await import("../../src/server/services/care-relationships");
      const { sendCareMessage } = await import(
        "../../src/server/services/care-messaging"
      );
      const {
        getCareMessages,
        getCareConversationsForUser,
      } = await import("../../src/server/queries/care-messaging");

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
      if (req.kind !== "ok") throw new Error("Expected req.kind === ok");

      const accepted = await acceptCareRelationship(specialistId, req.id);
      assert.equal(accepted.kind, "ok");
      if (accepted.kind !== "ok") throw new Error("Expected accepted.kind === ok");
      const conversationId = accepted.conversationId;

      // Specialist sends message
      await sendCareMessage({
        callerUserId: specialistId,
        conversationId,
        content: "Premier message du spécialiste.",
      });

      // 1. Stranger gets null (zero IDOR)
      const strangerGet = await getCareMessages(strangerId, conversationId);
      assert.equal(strangerGet, null);

      // 2. Parent checks conversations list: unreadCount should be 1
      const parentConvsBefore = await getCareConversationsForUser(parentId);
      assert.equal(parentConvsBefore.length, 1);
      assert.equal(parentConvsBefore[0]?.unreadCount, 1);
      assert.equal(
        parentConvsBefore[0]?.lastMessagePreview,
        "Premier message du spécialiste.",
      );

      // 3. Parent opens messages: should get messages and mark them read
      const parentData = await getCareMessages(parentId, conversationId);
      assert.ok(parentData);
      assert.equal(parentData.messages.length, 1);
      assert.equal(parentData.messages[0]?.content, "Premier message du spécialiste.");
      assert.equal(parentData.messages[0]?.isMine, false);

      // 4. Check message status updated to READ
      const msgAfter = await client.query(
        `select status from care_message where conversation_id = $1`,
        [conversationId],
      );
      assert.equal(msgAfter.rows[0]?.status, "READ");

      // 5. Parent checks conversations list again: unreadCount should now be 0
      const parentConvsAfter = await getCareConversationsForUser(parentId);
      assert.equal(parentConvsAfter[0]?.unreadCount, 0);

      await cleanupUsers(client, allUsers);
    });
  },
);

test(
  "read-only freeze: ending care relationship blocks new messages but preserves reading",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const {
        requestCareRelationship,
        acceptCareRelationship,
        endCareRelationship,
      } = await import("../../src/server/services/care-relationships");
      const { sendCareMessage } = await import(
        "../../src/server/services/care-messaging"
      );
      const { getCareMessages } = await import(
        "../../src/server/queries/care-messaging"
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
      if (req.kind !== "ok") throw new Error("Expected req.kind === ok");

      const accepted = await acceptCareRelationship(specialistId, req.id);
      assert.equal(accepted.kind, "ok");
      if (accepted.kind !== "ok") throw new Error("Expected accepted.kind === ok");
      const conversationId = accepted.conversationId;

      // Exchange a message while active
      await sendCareMessage({
        callerUserId: specialistId,
        conversationId,
        content: "Message avant la fin du suivi.",
      });

      // End relationship
      const endResult = await endCareRelationship(
        parentId,
        req.id,
        "Objectifs atteints",
      );
      assert.equal(endResult.kind, "ok");

      // Verify conversation is READ_ONLY
      const convRow = await client.query(
        `select status from care_conversation where id = $1`,
        [conversationId],
      );
      assert.equal(convRow.rows[0]?.status, "READ_ONLY");

      // Attempt to send a new message must be rejected
      const sendAfterEnd = await sendCareMessage({
        callerUserId: specialistId,
        conversationId,
        content: "Tentative de message après clôture",
      });
      assert.equal(sendAfterEnd.kind, "conversation_read_only");

      const parentSendAfterEnd = await sendCareMessage({
        callerUserId: parentId,
        conversationId,
        content: "Tentative parentale après clôture",
      });
      assert.equal(parentSendAfterEnd.kind, "conversation_read_only");

      // Reading past history is still fully preserved
      const history = await getCareMessages(specialistId, conversationId);
      assert.ok(history);
      assert.equal(history.conversation.status, "READ_ONLY");
      assert.equal(history.messages.length, 1);
      assert.equal(history.messages[0]?.content, "Message avant la fin du suivi.");

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
