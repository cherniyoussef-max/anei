import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import {
  checkAndGrantAvsCertification,
  getAvsCertificationProof,
} from "@/server/services/avs-certification-engine";

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

test("Zero-Trust AVS Certification Pipeline Integration Test", async (t) => {
  if (!url) {
    t.skip("No postgres database available for integration test");
    return;
  }

  const testUserId = `test-user-avs-${crypto.randomUUID().slice(0, 8)}`;
  const testCourseId = `test-course-tsa-${crypto.randomUUID().slice(0, 8)}`;

  await withClient(async (client) => {
    // 1. Seed user and qualifying TSA course
    await client.query(
      `insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
       values ($1, 'Hana Testeur AVS', $2, true, 'USER', now(), now())`,
      [testUserId, `${testUserId}@example.com`]
    );

    await client.query(
      `insert into courses (
        id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
        category, level, mode, trainer_name, duration_minutes, price_millimes,
        published, featured, qualifies_for_professional_promotion, qualifying_target_type, objectives, created_at, updated_at
      ) values ($1, $2, 'Accompagnement Spécialisé Autisme (TSA)', 'المرافقة المتخصصة لطيف التوحد',
        'Résumé FR', 'ملخص عربي', 'Description FR', 'وصف عربي',
        'AVS', 'advanced', 'online', 'Dr. Amira', 180, 50000,
        true, true, true, 'AVS', '{"fr": ["Objectif 1"], "ar": ["هدف 1"]}'::jsonb, now(), now())`,
      [testCourseId, `course-${testCourseId}`]
    );

    try {
      // 2. Attempt with score < 80% (75%) -> Must fail with SCORE_BELOW_80
      const failedResult = await checkAndGrantAvsCertification(testUserId, testCourseId, 75);
      assert.equal(failedResult.granted, false);
      assert.equal(failedResult.reason, "SCORE_BELOW_80");

      const resAfterFail = await client.query(
        `select * from avs_profiles where user_id = $1`,
        [testUserId]
      );
      assert.equal(resAfterFail.rows.length, 0, "No certified profile should be created on failing score");

      // 3. Attempt with score >= 80% (88%) -> Must grant certification
      const successResult = await checkAndGrantAvsCertification(testUserId, testCourseId, 88);
      assert.equal(successResult.granted, true);
      assert.ok(successResult.uniqueIdentifier);
      assert.match(successResult.uniqueIdentifier!, /^ANEI-AVS-\d{4}-[0-9A-Z]+$/);
      assert.ok(successResult.certificateHash);

      // Verify in PostgreSQL database
      const profileRes = await client.query(
        `select * from avs_profiles where user_id = $1`,
        [testUserId]
      );
      assert.equal(profileRes.rows.length, 1);
      const profileRow = profileRes.rows[0];

      assert.equal(profileRow.certified, true);
      assert.equal(profileRow.verification_status, "CERTIFIED_ACTIVE");
      assert.equal(profileRow.visible, true);
      assert.equal(profileRow.unique_identifier, successResult.uniqueIdentifier);
      assert.ok(profileRow.verified_at);

      // Verify log entry in avs_certifications_log
      const logRes = await client.query(
        `select * from avs_certifications_log where user_id = $1 and course_id = $2`,
        [testUserId, testCourseId]
      );
      assert.equal(logRes.rows.length, 1);
      const logRow = logRes.rows[0];
      assert.equal(logRow.score_percent, 88);
      assert.equal(logRow.certificate_hash, successResult.certificateHash);

      // 4. Test Proof Retrieval by Unique Identifier
      const proof = await getAvsCertificationProof(successResult.uniqueIdentifier!);
      assert.ok(proof);
      assert.equal(proof.isCertified, true);
      assert.equal(proof.uniqueIdentifier, successResult.uniqueIdentifier);
      assert.equal(proof.certifications.length, 1);
      assert.equal(proof.certifications[0].scorePercent, 88);
      assert.equal(proof.certifications[0].certificateHash, successResult.certificateHash);

      // 5. Test Idempotency with improved score (95%)
      const secondResult = await checkAndGrantAvsCertification(testUserId, testCourseId, 95);
      assert.equal(secondResult.granted, true);
      // Unique identifier MUST remain unchanged!
      assert.equal(secondResult.uniqueIdentifier, successResult.uniqueIdentifier);

      const updatedLogRes = await client.query(
        `select * from avs_certifications_log where user_id = $1 and course_id = $2`,
        [testUserId, testCourseId]
      );
      assert.equal(updatedLogRes.rows.length, 1);
      assert.equal(updatedLogRes.rows[0].score_percent, 95);
    } finally {
      // Cleanup
      await client.query(`delete from avs_certifications_log where user_id = $1`, [testUserId]);
      await client.query(`delete from avs_profiles where user_id = $1`, [testUserId]);
      await client.query(`delete from courses where id = $1`, [testCourseId]);
      await client.query(`delete from "user" where id = $1`, [testUserId]);
    }
  });
});
