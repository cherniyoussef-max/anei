import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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

test("Webinars Workflow: account-based registration with custom form, admin approval, unique code & notification", async () => {
  await withClient(async (client) => {
    const {
      registerWebinarParticipant,
      approveWebinarRegistration,
      trackWebinarJoin,
      getWebinarStats,
    } = await import("../../src/server/services/webinars");
    const { hashAccessCode } = await import("../../src/lib/webinars");

    const testId = crypto.randomUUID();
    const webinarSlug = `test-meet-form-${testId.slice(0, 8)}`;
    const startsAt = new Date(Date.now() + 86400 * 1000 * 7); // 7 days in future

    // 1. Seed a published test webinar with requireApproval = true and custom form_fields
    const formFields = JSON.stringify([
      { id: "phone", label: "Numéro de téléphone", type: "phone", required: true },
      { id: "role", label: "Votre profession / rôle", type: "text", required: true },
      { id: "expectations", label: "Vos attentes principales", type: "textarea", required: false },
    ]);

    const webinarInsert = await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, max_participants, published, require_approval, form_fields
       ) VALUES ($1, $2, 'Webinaire Pratiques Inclusives', 'ندوة الممارسات الدامجة',
                 'Description test', 'وصف تجريبي', 'Formateur Test', $3,
                 60, 'google_meet', 'https://meet.google.com/test-abc-def',
                 100, true, true, $4::jsonb)
       RETURNING id`,
      [testId, webinarSlug, startsAt.toISOString(), formFields],
    );
    const webinarId = webinarInsert.rows[0].id;

    // 2. Seed a test member user
    const userId = crypto.randomUUID();
    const userEmail = `member-${userId.slice(0, 8)}@example.test`;
    await client.query(
      `INSERT INTO "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
       VALUES ($1, 'Enseignant Test', $2, true, 'USER', 'teacher', now(), now())`,
      [userId, userEmail],
    );

    try {
      // 3. Register user with form answers
      const regResult = await registerWebinarParticipant({
        webinarId,
        userId,
        answers: {
          phone: "+21620123456",
          role: "Enseignant spécialisé",
          expectations: "Découvrir de nouveaux outils de différenciation.",
        },
      });

      assert.equal(regResult.ok, true);
      assert.ok(regResult.registrationId);
      assert.equal(regResult.status, "PENDING_APPROVAL");
      assert.equal(regResult.alreadyRegistered, false);

      // Verify row in DB: status is PENDING_APPROVAL and answers are saved
      const regRow = await client.query(
        `SELECT id, user_id, status, answers, access_code, joined_at
         FROM "webinar_registrations" WHERE id = $1`,
        [regResult.registrationId],
      );
      assert.equal(regRow.rows.length, 1);
      assert.equal(regRow.rows[0].user_id, userId);
      assert.equal(regRow.rows[0].status, "PENDING_APPROVAL");
      assert.equal(regRow.rows[0].answers?.phone, "+21620123456");
      assert.equal(regRow.rows[0].answers?.role, "Enseignant spécialisé");
      assert.equal(regRow.rows[0].access_code, null);

      // Stats check: 1 pending
      let stats = await getWebinarStats(webinarId);
      assert.equal(stats.total, 1);
      assert.equal(stats.pending, 1);
      assert.equal(stats.accepted, 0);

      // 4. Admin approves the registration
      const approval = await approveWebinarRegistration({ registrationId: regResult.registrationId!, actorAdminId: "test-admin-id", locale: "fr" });
      assert.equal(approval.ok, true);
      assert.ok(approval.accessCode);
      assert.ok(approval.accessCode.startsWith("MEET-"));

      // Verify DB row updated to ACCEPTED with access_code
      const approvedRow = await client.query(
        `SELECT status, access_code FROM "webinar_registrations" WHERE id = $1`,
        [regResult.registrationId],
      );
      assert.equal(approvedRow.rows[0].status, "ACCEPTED");
      assert.equal(approvedRow.rows[0].access_code, hashAccessCode(approval.accessCode!));
      assert.notEqual(approvedRow.rows[0].access_code, approval.accessCode);

      // Verify in-platform notification created
      const notifRow = await client.query(
        `SELECT id, type, title, body, href FROM "notifications" WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      assert.equal(notifRow.rows.length, 1);
      assert.equal(notifRow.rows[0].type, "webinar_access_granted");
      assert.ok(notifRow.rows[0].body.includes(approval.accessCode!));

      // Stats check: 1 accepted, 0 pending
      stats = await getWebinarStats(webinarId);
      assert.equal(stats.total, 1);
      assert.equal(stats.pending, 0);
      assert.equal(stats.accepted, 1);

      // 5. User joins using unique accessCode
      const joinResult = await trackWebinarJoin({
        webinarId,
        accessCode: approval.accessCode,
      });
      assert.equal(joinResult.ok, true);
      assert.equal(joinResult.meetingUrl, "https://meet.google.com/test-abc-def");

      // Verify attendance tracked
      const attendedRow = await client.query(
        `SELECT status, joined_at FROM "webinar_registrations" WHERE id = $1`,
        [regResult.registrationId],
      );
      assert.equal(attendedRow.rows[0].status, "ATTENDED");
      assert.ok(attendedRow.rows[0].joined_at !== null);

      stats = await getWebinarStats(webinarId);
      assert.equal(stats.attended, 1);
    } finally {
      // Cleanup
      await client.query(`DELETE FROM "notifications" WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id = $1`, [webinarId]);
      await client.query(`DELETE FROM "webinars" WHERE id = $1`, [webinarId]);
      await client.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
      const { pool } = await import("../../src/server/db");
      await pool.end();
    }
  });
});
