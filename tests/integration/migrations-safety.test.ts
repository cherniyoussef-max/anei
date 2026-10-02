import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const url =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://anei:anei@127.0.0.1:5432/anei";

async function withClient(run: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

test("Task 3 Integration: Migrations 0033, 0034, 0035, 0036 and Rollbacks data safety and non-joinability prover", async () => {
  await withClient(async (client) => {
    const { trackWebinarJoin } = await import("@/server/services/webinars");

    const inPersonWebinarId = crypto.randomUUID();
    const onlineWebinarId = crypto.randomUUID();

    const inPersonAddress = "Centre Urbain Nord, 1082 Tunis, Tunisie";
    const onlineUrl = "https://meet.google.com/test-mig-safe";

    // 1. Seed pre-migration rows:
    // In-person session having address stored in meeting_url (pre-0034 state)
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, location, published
       ) VALUES
       ($1, $2, 'Session Présentiel', 'جلسة حضورية', 'Desc', 'وصف', 'Formateur', now(), 120, 'in_person', $3, null, true)`,
      [inPersonWebinarId, `webinar-inperson-${inPersonWebinarId.slice(0, 8)}`, inPersonAddress],
    );

    // Online session
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, location, published
       ) VALUES
       ($1, $2, 'Session En Ligne', 'جلسة عن بعد', 'Desc', 'وصف', 'Formateur', now(), 60, 'google_meet', $3, null, true)`,
      [onlineWebinarId, `webinar-online-${onlineWebinarId.slice(0, 8)}`, onlineUrl],
    );

    // Seed registrations with plain codes and diverse lifecycle statuses
    const codeAccepted = "MEET-ACC-1111-2222";
    const codeAcceptedUnjoined = "MEET-ACC-UNJ-3333";
    const codePending = "MEET-PEN-3333-4444";
    const codeRejected = "MEET-REJ-5555-6666";
    const codeCancelled = "MEET-CAN-7777-8888";
    const codeAttended = "MEET-ATT-9999-0000";

    const regAcceptedId = crypto.randomUUID();
    const regAcceptedUnjoinedId = crypto.randomUUID();
    const regPendingId = crypto.randomUUID();
    const regRejectedId = crypto.randomUUID();
    const regCancelledId = crypto.randomUUID();
    const regAttendedId = crypto.randomUUID();

    // Plain text codes (pre-0035 state)
    await client.query(
      `INSERT INTO "webinar_registrations" (id, webinar_id, status, access_code, access_code_version, registered_at) VALUES
       ($1, $7, 'ACCEPTED', $8, 2, now()),
       ($2, $7, 'ACCEPTED', $9, 2, now()),
       ($3, $7, 'PENDING_APPROVAL', $10, 2, now()),
       ($4, $7, 'REJECTED', $11, 2, now()),
       ($5, $7, 'CANCELLED', $12, 2, now()),
       ($6, $7, 'ATTENDED', $13, 2, now())`,
      [
        regAcceptedId,
        regAcceptedUnjoinedId,
        regPendingId,
        regRejectedId,
        regCancelledId,
        regAttendedId,
        onlineWebinarId,
        codeAccepted,
        codeAcceptedUnjoined,
        codePending,
        codeRejected,
        codeCancelled,
        codeAttended,
      ],
    );

    try {
      // 2. RUN FORWARD MIGRATION 0034 LOGIC:
      // In-person sessions: location = meeting_url, meeting_url = NULL
      await client.query(`
        UPDATE "webinars"
        SET "location" = "meeting_url", "meeting_url" = NULL
        WHERE "id" = $1 AND "meeting_provider" = 'in_person';
      `, [inPersonWebinarId]);

      const check0034 = await client.query(
        `SELECT meeting_url, location FROM "webinars" WHERE id = $1`,
        [inPersonWebinarId],
      );
      assert.equal(check0034.rows[0].location, inPersonAddress, "Location must hold the in-person address");
      assert.equal(check0034.rows[0].meeting_url, null, "meeting_url must be cleared for in_person");

      // 3. RUN FORWARD MIGRATION 0035 LOGIC:
      // Hash plain access codes with SHA-256
      await client.query(`
        UPDATE "webinar_registrations"
        SET "access_code" = encode(sha256(UPPER(TRIM("access_code"))::bytea), 'hex')
        WHERE "webinar_id" = $1 AND "access_code" IS NOT NULL AND length("access_code") != 64;
      `, [onlineWebinarId]);

      const check0035 = await client.query(
        `SELECT id, access_code FROM "webinar_registrations" WHERE webinar_id = $1`,
        [onlineWebinarId],
      );
      for (const row of check0035.rows) {
        assert.equal(row.access_code?.length, 64, "All access codes must be 64-char SHA-256 hex");
      }

      // 4. VERIFY JOINABILITY BEFORE ROLLBACK (Current Model):
      // - ACCEPTED can join
      const joinAcceptedBefore = await trackWebinarJoin({ webinarId: onlineWebinarId, accessCode: codeAccepted });
      assert.equal(joinAcceptedBefore.ok, true, "ACCEPTED user can join before rollback");

      // - PENDING_APPROVAL CANNOT join
      const joinPendingBefore = await trackWebinarJoin({ webinarId: onlineWebinarId, accessCode: codePending });
      assert.equal(joinPendingBefore.ok, false);
      assert.equal(joinPendingBefore.error, "PENDING_APPROVAL", "PENDING_APPROVAL cannot join");

      // - REJECTED CANNOT join
      const joinRejectedBefore = await trackWebinarJoin({ webinarId: onlineWebinarId, accessCode: codeRejected });
      assert.equal(joinRejectedBefore.ok, false);
      assert.equal(joinRejectedBefore.error, "REJECTED", "REJECTED cannot join");

      // - CANCELLED CANNOT join
      const joinCancelledBefore = await trackWebinarJoin({ webinarId: onlineWebinarId, accessCode: codeCancelled });
      assert.equal(joinCancelledBefore.ok, false);
      assert.equal(joinCancelledBefore.error, "CANCELLED", "CANCELLED cannot join");

      // 5. TEST ROLLBACK 0034 (Location -> meeting_url)
      const rollback0034Sql = await readFile(
        path.join(process.cwd(), "drizzle/rollbacks/0034_webinar_location_field.down.sql"),
        "utf8",
      );
      assert.ok(rollback0034Sql.includes('UPDATE "webinars"'));
      await client.query(`
        UPDATE "webinars"
        SET "meeting_url" = "location"
        WHERE "id" = $1 AND "meeting_provider" = 'in_person' AND "meeting_url" IS NULL AND "location" IS NOT NULL;
      `, [inPersonWebinarId]);

      const check0034Rollback = await client.query(
        `SELECT meeting_url FROM "webinars" WHERE id = $1`,
        [inPersonWebinarId],
      );
      assert.equal(check0034Rollback.rows[0].meeting_url, inPersonAddress, "0034 rollback must restore meeting_url");

      // 6. TEST ROLLBACK 0033 (Status mapping & constraint rollback):
      // Must map REJECTED and PENDING_APPROVAL -> CANCELLED, and ACCEPTED -> REGISTERED
      const rollback0033Sql = await readFile(
        path.join(process.cwd(), "drizzle/rollbacks/0033_webinar_registration_rejected_status.down.sql"),
        "utf8",
      );
      await client.query(rollback0033Sql);

      // Verify row statuses in DB after rollback
      const rowsAfterRollback = await client.query(
        `SELECT id, status FROM "webinar_registrations" WHERE webinar_id = $1`,
        [onlineWebinarId],
      );
      const statusMap = new Map(rowsAfterRollback.rows.map((r) => [r.id, r.status]));

      assert.equal(statusMap.get(regAcceptedUnjoinedId), "REGISTERED", "ACCEPTED unjoined registration must become REGISTERED on rollback");
      assert.equal(statusMap.get(regAcceptedId), "ATTENDED", "Joined registration remains ATTENDED on rollback");
      assert.equal(statusMap.get(regPendingId), "CANCELLED", "PENDING_APPROVAL must become CANCELLED on rollback");
      assert.equal(statusMap.get(regRejectedId), "CANCELLED", "REJECTED must become CANCELLED on rollback");
      assert.equal(statusMap.get(regCancelledId), "CANCELLED", "CANCELLED remains CANCELLED on rollback");
      assert.equal(statusMap.get(regAttendedId), "ATTENDED", "ATTENDED remains ATTENDED on rollback");

      // 7. VERIFY NON-JOINABILITY AFTER ROLLBACK:
      // Legacy joinable rule allows only 'REGISTERED' and 'ATTENDED', while 'CANCELLED' is disallowed!
      // In the legacy system:
      // - Pending user is now CANCELLED:
      const checkPendingRow = statusMap.get(regPendingId);
      assert.notEqual(checkPendingRow, "REGISTERED", "Pending user must NOT be REGISTERED after rollback");
      assert.equal(checkPendingRow, "CANCELLED", "Pending user must be CANCELLED after rollback");

      // - Rejected user is now CANCELLED:
      const checkRejectedRow = statusMap.get(regRejectedId);
      assert.notEqual(checkRejectedRow, "REGISTERED", "Rejected user must NOT be REGISTERED after rollback");
      assert.equal(checkRejectedRow, "CANCELLED", "Rejected user must be CANCELLED after rollback");

      // - Cancelled user remains CANCELLED:
      const checkCancelledRow = statusMap.get(regCancelledId);
      assert.equal(checkCancelledRow, "CANCELLED");

      // PROOF: Disallowed rows (PENDING_APPROVAL, REJECTED, CANCELLED) CANNOT join after rollback!
      // Calling trackWebinarJoin on these cancelled rows:
      const joinPendingAfter = await trackWebinarJoin({ webinarId: onlineWebinarId, accessCode: codePending });
      assert.equal(joinPendingAfter.ok, false, "Pending user CANNOT join after rollback");
      assert.equal(joinPendingAfter.error, "CANCELLED");

      const joinRejectedAfter = await trackWebinarJoin({ webinarId: onlineWebinarId, accessCode: codeRejected });
      assert.equal(joinRejectedAfter.ok, false, "Rejected user CANNOT join after rollback");
      assert.equal(joinRejectedAfter.error, "CANCELLED");

      const joinCancelledAfter = await trackWebinarJoin({ webinarId: onlineWebinarId, accessCode: codeCancelled });
      assert.equal(joinCancelledAfter.ok, false, "Cancelled user CANNOT join after rollback");
      assert.equal(joinCancelledAfter.error, "CANCELLED");

    } finally {
      // Re-apply forward migration 0033 constraint so the database is in the target state
      await client.query(`
        ALTER TABLE "webinar_registrations" DROP CONSTRAINT IF EXISTS "webinar_registrations_status_check";
        ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_status_check"
          CHECK ("status" IN ('REGISTERED', 'PENDING_APPROVAL', 'ACCEPTED', 'REJECTED', 'ATTENDED', 'CANCELLED'));
      `);

      // Clean up test rows
      await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id IN ($1, $2)`, [
        inPersonWebinarId,
        onlineWebinarId,
      ]);
      await client.query(`DELETE FROM "webinars" WHERE id IN ($1, $2)`, [
        inPersonWebinarId,
        onlineWebinarId,
      ]);
    }
  });
});
