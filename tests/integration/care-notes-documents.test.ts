process.env.STORAGE_PROVIDER = "s3-compatible";
process.env.STORAGE_BUCKET = "anei-test-bucket";
process.env.STORAGE_REGION = "us-east-1";
process.env.STORAGE_ACCESS_KEY_ID = "test-access-key-id";
process.env.STORAGE_SECRET_ACCESS_KEY = "test-secret-access-key";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import {
  createSessionNote,
  updateSessionNote,
  createNoteAddendum,
  registerCareDocument,
  getPresignedCareDocumentDownload,
} from "../../src/server/services/care-notes-documents";
import {
  getChildCareTeam,
  getSharedNotesForChild,
  getSharedDocumentsForChild,
} from "../../src/server/queries/care-notes-documents";

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
  const email = `care-nd-${userId}@example.test`;
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

async function seedActiveCareRelationship(
  client: Client,
  specialistId: string,
  studentId: string,
  parentId: string,
) {
  const assignmentId = crypto.randomUUID();
  await client.query(
    `insert into specialist_student_assignment (
      id, specialist_user_id, student_user_id, requested_by_user_id, status,
      consent_accepted_at, consent_version, start_date, created_by, created_at, updated_at
    ) values ($1, $2, $3, $4, 'ACTIVE', now(), 'v1', now(), $4, now(), now())`,
    [assignmentId, specialistId, studentId, parentId],
  );

  const convId = crypto.randomUUID();
  await client.query(
    `insert into care_conversation (id, specialist_user_id, student_user_id, care_relationship_id, status, created_at, updated_at)
     values ($1, $2, $3, $4, 'OPEN', now(), now())`,
    [convId, specialistId, studentId, assignmentId],
  );

  await client.query(
    `insert into care_conversation_participant (id, conversation_id, user_id, role, created_at)
     values ($1, $2, $3, 'SPECIALIST', now()), ($4, $2, $5, 'PARENT', now())`,
    [crypto.randomUUID(), convId, specialistId, crypto.randomUUID(), parentId],
  );

  return { assignmentId, convId };
}

async function cleanupUsers(client: Client, userIds: string[]) {
  if (userIds.length === 0) return;
  await client.query(`delete from care_access_log where actor_user_id = any($1) or student_id = any($1)`, [userIds]);
  await client.query(`delete from care_document where uploaded_by_user_id = any($1) or student_id = any($1)`, [userIds]);
  await client.query(`delete from specialist_session_note where specialist_user_id = any($1) or student_id = any($1)`, [userIds]);
  await client.query(`delete from care_conversation_participant where user_id = any($1)`, [userIds]);
  await client.query(`delete from care_conversation where specialist_user_id = any($1) or student_user_id = any($1)`, [userIds]);
  await client.query(`delete from specialist_student_assignment where specialist_user_id = any($1) or student_user_id = any($1) or requested_by_user_id = any($1)`, [userIds]);
  await client.query(`delete from parent_student_link where parent_user_id = any($1) or student_user_id = any($1)`, [userIds]);
  await client.query(`delete from notifications where user_id = any($1)`, [userIds]);
  await client.query(`delete from persona_membership where user_id = any($1)`, [userIds]);
  await client.query(`delete from "user" where id = any($1::text[])`, [userIds]);
}

// Clean up pg pool after all tests run
test.after(async () => {
  const { pool } = await import("../../src/server/db");
  await pool.end().catch(() => undefined);
});

test("Care Notes: specialist creates PRIVATE and SHARED notes, parent only sees SHARED notes", async () => {
  await withClient(async (client) => {
    const parentId = await seedUserWithPersona(client, "PARENT", "ACTIVE", "Maman Yasmine");
    const strangerParentId = await seedUserWithPersona(client, "PARENT", "ACTIVE", "Parent Etranger");
    const childId = await seedUserWithPersona(client, "STUDENT", "ACTIVE", "Adam");
    const specialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE", "Dr. Orthophoniste");

    const createdUsers = [parentId, strangerParentId, childId, specialistId];

    try {
      await seedParentStudentLink(client, parentId, childId);
      const { assignmentId } = await seedActiveCareRelationship(
        client,
        specialistId,
        childId,
        parentId,
      );

      // Specialist creates PRIVATE note
      const privateNoteRes = await createSessionNote(specialistId, {
        assignmentId,
        title: "Observations cliniques internes",
        content: "Hypothèse de trouble phonologique à investiguer.",
        visibility: "PRIVATE",
        sessionDate: new Date(),
      });
      if (privateNoteRes.kind !== "ok") throw new Error("Failed to create private note");

      // Specialist creates SHARED note
      const sharedNoteRes = await createSessionNote(specialistId, {
        assignmentId,
        title: "Bilan de séance hebdomadaire",
        content: "Excellente participation aux exercices d'articulation.",
        visibility: "SHARED",
        sessionDate: new Date(),
      });
      if (sharedNoteRes.kind !== "ok") throw new Error("Failed to create shared note");

      // Parent queries shared notes
      const parentNotes = await getSharedNotesForChild(childId, parentId);
      assert.ok(parentNotes !== null, "Parent notes should not be null");
      assert.equal(parentNotes.length, 1, "Parent must ONLY see the 1 SHARED note");
      assert.equal(parentNotes[0]!.title, "Bilan de séance hebdomadaire");
      assert.equal(parentNotes[0]!.specialist.name, "Dr. Orthophoniste");

      // Unlinked stranger parent queries child notes -> receives null (404/IDOR blocked)
      const strangerNotes = await getSharedNotesForChild(childId, strangerParentId);
      assert.equal(strangerNotes, null, "Stranger parent must not access child notes");

      // Access log check: verify that parent read access was recorded in care_access_log
      const logRows = await client.query(
        `select * from care_access_log where actor_user_id = $1 and student_id = $2 and resource_type = 'SESSION_NOTE'`,
        [parentId, childId],
      );
      assert.ok(logRows.rows.length >= 1, "Access log must record parent reading session notes");
    } finally {
      await cleanupUsers(client, createdUsers);
    }
  });
});

test("Care Notes 24h Immutability: direct edits blocked after 24h, addendum allowed", async () => {
  await withClient(async (client) => {
    const parentId = await seedUserWithPersona(client, "PARENT", "ACTIVE", "Papa Karim");
    const childId = await seedUserWithPersona(client, "STUDENT", "ACTIVE", "Sami");
    const specialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE", "Dr. Psychomot");

    const createdUsers = [parentId, childId, specialistId];

    try {
      await seedParentStudentLink(client, parentId, childId);
      const { assignmentId } = await seedActiveCareRelationship(
        client,
        specialistId,
        childId,
        parentId,
      );

      // Create a shared note
      const noteRes = await createSessionNote(specialistId, {
        assignmentId,
        title: "Séance équilibre",
        content: "Bonne progression.",
        visibility: "SHARED",
        sessionDate: new Date(),
      });
      if (noteRes.kind !== "ok") throw new Error("Failed to create note");

      // Edit within 24h -> succeeds
      const updateRes1 = await updateSessionNote(specialistId, {
        noteId: noteRes.id,
        title: "Séance équilibre corrigée",
        content: "Bonne progression générale.",
        visibility: "SHARED",
      });
      assert.equal(updateRes1.kind, "ok");

      // Manually set created_at to 26 hours in the past
      await client.query(
        `update specialist_session_note set created_at = now() - interval '26 hours' where id = $1`,
        [noteRes.id],
      );

      // Edit after 24h -> returns immutable_after_24h
      const updateRes2 = await updateSessionNote(specialistId, {
        noteId: noteRes.id,
        title: "Modification tardive interdite",
        content: "Texte modifié.",
        visibility: "SHARED",
      });
      assert.equal(updateRes2.kind, "immutable_after_24h", "Must block edits after 24 hours");

      // Create an addendum instead -> succeeds!
      const addendumRes = await createNoteAddendum(specialistId, {
        parentNoteId: noteRes.id,
        content: "Précision ajoutée le lendemain suite aux retours de l'enseignant.",
      });
      assert.equal(addendumRes.kind, "ok", "Addendum must succeed");

      // Check notes in DB
      const addendumRow = await client.query(
        `select * from specialist_session_note where id = $1`,
        [(addendumRes as { kind: "ok"; id: string }).id],
      );
      assert.equal(addendumRow.rows[0].is_addendum, true);
      assert.equal(addendumRow.rows[0].parent_note_id, noteRes.id);
    } finally {
      await cleanupUsers(client, createdUsers);
    }
  });
});

test("Care Documents & Care Team: upload, parent download entitlement, and care team summary", async () => {
  await withClient(async (client) => {
    const parentId = await seedUserWithPersona(client, "PARENT", "ACTIVE", "Maman Nour");
    const strangerId = await seedUserWithPersona(client, "PARENT", "ACTIVE", "Inconnu");
    const childId = await seedUserWithPersona(client, "STUDENT", "ACTIVE", "Nour");
    const specialistId = await seedUserWithPersona(client, "SPECIALIST", "ACTIVE", "Dr. Pedopsy");

    const createdUsers = [parentId, strangerId, childId, specialistId];

    try {
      await seedParentStudentLink(client, parentId, childId);
      const { assignmentId } = await seedActiveCareRelationship(
        client,
        specialistId,
        childId,
        parentId,
      );

      // Register shared document
      const docRes = await registerCareDocument(specialistId, {
        assignmentId,
        fileName: "bilan-initial.pdf",
        objectKey: "care/2026-09-26/test-bilan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024 * 1024,
        title: "Bilan psychologique initial",
        documentType: "ASSESSMENT",
        visibility: "SHARED",
      });
      if (docRes.kind !== "ok") throw new Error("Failed to register document");

      // Parent queries shared documents
      const docs = await getSharedDocumentsForChild(childId, parentId);
      assert.ok(docs !== null);
      assert.equal(docs.length, 1);
      assert.equal(docs[0]!.fileName, "bilan-initial.pdf");

      // Parent downloads document -> produces downloadUrl and logs access
      const downloadRes = await getPresignedCareDocumentDownload(parentId, docRes.id);
      assert.equal(downloadRes.kind, "ok");
      if (downloadRes.kind === "ok") {
        assert.ok(downloadRes.downloadUrl.includes("test-bilan.pdf") || downloadRes.downloadUrl.length > 0);
      }

      // Stranger tries to download document -> forbidden (IDOR blocked)
      const strangerDownload = await getPresignedCareDocumentDownload(strangerId, docRes.id);
      assert.equal(strangerDownload.kind, "forbidden", "Stranger must be forbidden from downloading document");

      // Parent queries care team
      const team = await getChildCareTeam(childId, parentId);
      assert.ok(team !== null);
      assert.equal(team.length, 1);
      assert.equal(team[0]!.specialist.name, "Dr. Pedopsy");
      assert.ok(team[0]!.conversationId !== null);
    } finally {
      await cleanupUsers(client, createdUsers);
    }
  });
});
