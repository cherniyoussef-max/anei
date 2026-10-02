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

test("Fix 1 Security Test: trackWebinarJoin broken access control & leak prevention", async () => {
  await withClient(async (client) => {
    const { trackWebinarJoin } = await import("../../src/server/services/webinars");

    const webinarId = crypto.randomUUID();
    const otherWebinarId = crypto.randomUUID();
    const userAId = crypto.randomUUID();
    const userBId = crypto.randomUUID();
    const nonRegUserId = crypto.randomUUID();

    const expectedMeetingUrl = "https://meet.google.com/sec-test-leak";
    const expectedReplayUrl = "https://cdn.anei.tn/replays/test-sec.mp4";

    const slugA = `webinar-sec-${webinarId.slice(0, 8)}`;
    const slugB = `webinar-oth-${otherWebinarId.slice(0, 8)}`;

    await client.query(`DELETE FROM "webinars" WHERE slug IN ('webinar-sec-test', 'webinar-other-test')`);

    // 1. Seed test webinars
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, replay_url, published
       ) VALUES
       ($1, $5, 'Webinaire Securite', 'ندوة أمنية', 'Desc', 'وصف', 'Formateur', now(), 60, 'google_meet', $3, $4, true),
       ($2, $6, 'Autre Webinaire', 'ندوة أخرى', 'Desc', 'وصف', 'Formateur', now(), 60, 'google_meet', 'https://meet.google.com/other', null, true)`,
      [webinarId, otherWebinarId, expectedMeetingUrl, expectedReplayUrl, slugA, slugB],
    );

    // 2. Seed test users
    const emailA = `usera-${userAId.slice(0, 8)}@example.test`;
    const emailB = `userb-${userBId.slice(0, 8)}@example.test`;
    const emailNonReg = `nonreg-${nonRegUserId.slice(0, 8)}@example.test`;

    await client.query(`DELETE FROM "user" WHERE email IN ('usera@example.test', 'userb@example.test', 'nonreg@example.test')`);

    await client.query(
      `INSERT INTO "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at) VALUES
       ($1, 'User A', $4, true, 'USER', 'teacher', now(), now()),
       ($2, 'User B', $5, true, 'USER', 'parent', now(), now()),
       ($3, 'User NonReg', $6, true, 'USER', 'learner', now(), now())`,
      [userAId, userBId, nonRegUserId, emailA, emailB, emailNonReg],
    );

    // 3. Seed registrations with various statuses
    const approvedTokenA = crypto.randomUUID();
    const approvedCodeA = "MEET-USRA";
    const approvedTokenB = crypto.randomUUID();
    const pendingToken = crypto.randomUUID();
    const rejectedToken = crypto.randomUUID();
    const cancelledToken = crypto.randomUUID();

    await client.query(
      `INSERT INTO "webinar_registrations" (id, webinar_id, user_id, status, join_token, access_code, registered_at) VALUES
       (gen_random_uuid(), $1, $2, 'ACCEPTED', $4, $5, now()),
       (gen_random_uuid(), $1, $3, 'ACCEPTED', $6, 'MEET-USRB', now()),
       (gen_random_uuid(), $1, null, 'PENDING_APPROVAL', $7, null, now()),
       (gen_random_uuid(), $1, null, 'REJECTED', $8, null, now()),
       (gen_random_uuid(), $1, null, 'CANCELLED', $9, null, now())`,
      [
        webinarId,
        userAId,
        userBId,
        approvedTokenA,
        approvedCodeA,
        approvedTokenB,
        pendingToken,
        rejectedToken,
        cancelledToken,
      ],
    );

    try {
      // Test 1: Anonymous user without credentials -> MUST FAIL with REGISTRATION_REQUIRED, NEVER leak meetingUrl
      const anonResult = await trackWebinarJoin({ webinarId });
      assert.equal(anonResult.ok, false, "Anonymous user should not get access");
      assert.equal(anonResult.error, "REGISTRATION_REQUIRED");
      assert.equal(anonResult.meetingUrl, null, "Meeting URL MUST be null for anonymous non-registered");

      // Test 2: Logged-in non-registered user -> MUST FAIL with REGISTRATION_REQUIRED
      const nonRegResult = await trackWebinarJoin({ webinarId, userId: nonRegUserId });
      assert.equal(nonRegResult.ok, false, "Non-registered user should not get access");
      assert.equal(nonRegResult.error, "REGISTRATION_REQUIRED");
      assert.equal(nonRegResult.meetingUrl, null, "Meeting URL MUST be null for non-registered user");

      // Test 3: Pending approval registration -> MUST FAIL with PENDING_APPROVAL
      const pendingResult = await trackWebinarJoin({ webinarId, joinToken: pendingToken });
      assert.equal(pendingResult.ok, false);
      assert.equal(pendingResult.error, "PENDING_APPROVAL");
      assert.equal(pendingResult.meetingUrl, null);

      // Test 4: Rejected registration -> MUST FAIL with REJECTED
      const rejectedResult = await trackWebinarJoin({ webinarId, joinToken: rejectedToken });
      assert.equal(rejectedResult.ok, false);
      assert.equal(rejectedResult.error, "REJECTED");
      assert.equal(rejectedResult.meetingUrl, null);

      // Test 5: Cancelled registration -> MUST FAIL with CANCELLED
      const cancelledResult = await trackWebinarJoin({ webinarId, joinToken: cancelledToken });
      assert.equal(cancelledResult.ok, false);
      assert.equal(cancelledResult.error, "CANCELLED");
      assert.equal(cancelledResult.meetingUrl, null);

      // Test 6: User A using User B's token -> MUST FAIL with UNAUTHORIZED / REGISTRATION_REQUIRED
      const spoofResult = await trackWebinarJoin({ webinarId, userId: userAId, joinToken: approvedTokenB });
      assert.equal(spoofResult.ok, false, "Cross-user token reuse must be rejected");
      assert.equal(spoofResult.meetingUrl, null);

      // Test 7: Forged / Non-existent join token -> MUST FAIL with REGISTRATION_REQUIRED
      const forgedResult = await trackWebinarJoin({ webinarId, joinToken: "completely-forged-token-uuid" });
      assert.equal(forgedResult.ok, false);
      assert.equal(forgedResult.error, "REGISTRATION_REQUIRED");
      assert.equal(forgedResult.meetingUrl, null);

      // Test 8: Non-existent webinar ID -> MUST FAIL with WEBINAR_NOT_FOUND
      const nonExistentWebinar = await trackWebinarJoin({ webinarId: crypto.randomUUID() });
      assert.equal(nonExistentWebinar.ok, false);
      assert.equal(nonExistentWebinar.error, "WEBINAR_NOT_FOUND");
      assert.equal(nonExistentWebinar.meetingUrl, null);

      // Test 9: Approved user via userId -> MUST SUCCEED with meetingUrl
      const approvedUserResult = await trackWebinarJoin({ webinarId, userId: userAId });
      assert.equal(approvedUserResult.ok, true);
      assert.equal(approvedUserResult.meetingUrl, expectedMeetingUrl);

      // Test 10: Approved user via valid joinToken -> MUST SUCCEED with meetingUrl
      const approvedTokenResult = await trackWebinarJoin({ webinarId, joinToken: approvedTokenA });
      assert.equal(approvedTokenResult.ok, true);
      assert.equal(approvedTokenResult.meetingUrl, expectedMeetingUrl);

      // Test 11: Approved user via valid accessCode -> MUST SUCCEED with meetingUrl
      const approvedCodeResult = await trackWebinarJoin({ webinarId, accessCode: approvedCodeA });
      assert.equal(approvedCodeResult.ok, true);
      assert.equal(approvedCodeResult.meetingUrl, expectedMeetingUrl);
    } finally {
      // Cleanup
      await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id IN ($1, $2)`, [webinarId, otherWebinarId]);
      await client.query(`DELETE FROM "webinars" WHERE id IN ($1, $2)`, [webinarId, otherWebinarId]);
      await client.query(`DELETE FROM "user" WHERE id IN ($1, $2, $3)`, [userAId, userBId, nonRegUserId]);
      const { pool } = await import("../../src/server/db");
      await pool.end();
    }
  });
});
