import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import { generateAccessCode, hashAccessCode } from "@/lib/webinars";

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

test("Task 1 & 2: trackWebinarJoin enforces single approved status (ACCEPTED) and rejects legacy version 1 codes", async () => {
  await withClient(async (client) => {
    const { trackWebinarJoin } = await import("@/server/services/webinars");

    const webinarId = crypto.randomUUID();
    const expectedMeetingUrl = "https://meet.google.com/test-status-model";

    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, published
       ) VALUES
       ($1, $2, 'Webinar Status Test', 'ندوة اختبار الحالة', 'Desc', 'وصف', 'Trainer', now(), 60, 'google_meet', $3, true)`,
      [webinarId, `webinar-status-${webinarId.slice(0, 8)}`, expectedMeetingUrl],
    );

    const rawAccepted = generateAccessCode("MEET");
    const rawAttended = generateAccessCode("MEET");
    const rawLegacyRegistered = generateAccessCode("MEET");
    const rawPending = generateAccessCode("MEET");
    const rawRejected = generateAccessCode("MEET");
    const rawCancelled = generateAccessCode("MEET");
    const rawLegacyV1 = generateAccessCode("MEET");

    await client.query(
      `INSERT INTO "webinar_registrations" (id, webinar_id, status, access_code, access_code_version, registered_at) VALUES
       (gen_random_uuid(), $1, 'ACCEPTED', $2, 2, now()),
       (gen_random_uuid(), $1, 'ATTENDED', $3, 2, now()),
       (gen_random_uuid(), $1, 'REGISTERED', $4, 2, now()),
       (gen_random_uuid(), $1, 'PENDING_APPROVAL', $5, 2, now()),
       (gen_random_uuid(), $1, 'REJECTED', $6, 2, now()),
       (gen_random_uuid(), $1, 'CANCELLED', $7, 2, now()),
       (gen_random_uuid(), $1, 'ACCEPTED', $8, 1, now())`,
      [
        webinarId,
        hashAccessCode(rawAccepted),
        hashAccessCode(rawAttended),
        hashAccessCode(rawLegacyRegistered),
        hashAccessCode(rawPending),
        hashAccessCode(rawRejected),
        hashAccessCode(rawCancelled),
        hashAccessCode(rawLegacyV1),
      ],
    );

    try {
      // 1. ACCEPTED can join
      const joinAccepted = await trackWebinarJoin({ webinarId, accessCode: rawAccepted });
      assert.equal(joinAccepted.ok, true);
      assert.equal(joinAccepted.meetingUrl, expectedMeetingUrl);

      // 2. ATTENDED can join
      const joinAttended = await trackWebinarJoin({ webinarId, accessCode: rawAttended });
      assert.equal(joinAttended.ok, true);
      assert.equal(joinAttended.meetingUrl, expectedMeetingUrl);

      // 3. REGISTERED (unmigrated legacy status) is NOT considered approved in the new model
      const joinRegistered = await trackWebinarJoin({ webinarId, accessCode: rawLegacyRegistered });
      assert.equal(joinRegistered.ok, false);
      assert.equal(joinRegistered.error, "REGISTRATION_REQUIRED");

      // 4. PENDING_APPROVAL cannot join
      const joinPending = await trackWebinarJoin({ webinarId, accessCode: rawPending });
      assert.equal(joinPending.ok, false);
      assert.equal(joinPending.error, "PENDING_APPROVAL");

      // 5. REJECTED cannot join
      const joinRejected = await trackWebinarJoin({ webinarId, accessCode: rawRejected });
      assert.equal(joinRejected.ok, false);
      assert.equal(joinRejected.error, "REJECTED");

      // 6. CANCELLED cannot join
      const joinCancelled = await trackWebinarJoin({ webinarId, accessCode: rawCancelled });
      assert.equal(joinCancelled.ok, false);
      assert.equal(joinCancelled.error, "CANCELLED");

      // 7. Legacy access code version 1 must be rejected with ACCESS_CODE_EXPIRED
      const joinV1 = await trackWebinarJoin({ webinarId, accessCode: rawLegacyV1 });
      assert.equal(joinV1.ok, false);
      assert.equal(joinV1.error, "ACCESS_CODE_EXPIRED");
    } finally {
      await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id = $1`, [webinarId]);
      await client.query(`DELETE FROM "webinars" WHERE id = $1`, [webinarId]);
    }
  });
});

test("Task 2 Security: /api/webinars/[id]/join exchanges query string code for HttpOnly cookie, 303 redirects to clean URL, and consumes cookie once", async () => {
  await withClient(async (client) => {
    const { GET } = await import("@/app/api/webinars/[id]/join/route");

    const webinarId = crypto.randomUUID();
    const meetingUrl = "https://meet.google.com/test-clean-redirect";
    const rawCode = generateAccessCode("MEET");

    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, published
       ) VALUES
       ($1, $2, 'Webinar Clean URL Test', 'ندوة الرابط النظيف', 'Desc', 'وصف', 'Trainer', now(), 60, 'google_meet', $3, true)`,
      [webinarId, `webinar-clean-${webinarId.slice(0, 8)}`, meetingUrl],
    );

    await client.query(
      `INSERT INTO "webinar_registrations" (id, webinar_id, status, access_code, access_code_version, registered_at) VALUES
       (gen_random_uuid(), $1, 'ACCEPTED', $2, 2, now())`,
      [webinarId, hashAccessCode(rawCode)],
    );

    try {
      // Step 1: Initial request with ?code= in query string
      const initialReq = new Request(`https://anei.tn/api/webinars/${webinarId}/join?code=${rawCode}`, {
        headers: { "x-forwarded-for": "198.51.100.123" },
      });
      const initialRes = await GET(initialReq, { params: Promise.resolve({ id: webinarId }) });

      // Must return HTTP 303 See Other
      assert.equal(initialRes.status, 303, "First request with code must return 303 redirect");
      const location = initialRes.headers.get("location");
      assert.ok(location);
      const locationUrl = new URL(location, "https://anei.tn");
      assert.equal(locationUrl.pathname, `/api/webinars/${webinarId}/join`);
      assert.equal(locationUrl.search, "", "Redirect destination must be a clean URL with no query parameters");
      assert.equal(initialRes.headers.get("referrer-policy"), "no-referrer");

      // Must set HttpOnly pass cookie
      const setCookieHeader = initialRes.headers.get("set-cookie");
      assert.ok(setCookieHeader, "Must set pass cookie");
      assert.ok(setCookieHeader.includes(`anei_webinar_pass_${webinarId}=`));
      assert.ok(setCookieHeader.toLowerCase().includes("httponly"));

      // Extract cookie value for subsequent request
      const cookieMatch = setCookieHeader.match(new RegExp(`anei_webinar_pass_${webinarId}=([^;]+)`));
      assert.ok(cookieMatch);
      const cookieValue = cookieMatch[1];

      // Step 2: Clean URL request with the HttpOnly pass cookie
      const cleanReq = new Request(`https://anei.tn/api/webinars/${webinarId}/join`, {
        headers: {
          "x-forwarded-for": "198.51.100.123",
          cookie: `anei_webinar_pass_${webinarId}=${cookieValue}`,
        },
      });
      const cleanRes = await GET(cleanReq, { params: Promise.resolve({ id: webinarId }) });

      // Must redirect to final meeting URL
      assert.equal(cleanRes.status, 302, "Clean request with pass cookie must redirect to meetingUrl");
      assert.equal(cleanRes.headers.get("location"), meetingUrl);
      assert.equal(cleanRes.headers.get("referrer-policy"), "no-referrer");

      // Must clear the pass cookie
      const clearCookieHeader = cleanRes.headers.get("set-cookie");
      assert.ok(clearCookieHeader, "Must clear pass cookie");
      assert.ok(clearCookieHeader.includes("Max-Age=0"));

      // Step 3: Second clean request with the same cookie MUST fail (consumed once!)
      const replayReq = new Request(`https://anei.tn/api/webinars/${webinarId}/join`, {
        headers: {
          "x-forwarded-for": "198.51.100.123",
          cookie: `anei_webinar_pass_${webinarId}=${cookieValue}`,
        },
      });
      const replayRes = await GET(replayReq, { params: Promise.resolve({ id: webinarId }) });
      assert.equal(replayRes.status, 302);
      assert.ok(
        replayRes.headers.get("location")?.includes("status=registration_required"),
        "Replaying already consumed pass cookie must fail",
      );
    } finally {
      await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id = $1`, [webinarId]);
      await client.query(`DELETE FROM "webinars" WHERE id = $1`, [webinarId]);
    }
  });
});

test("Task 2: rotateLegacyWebinarCodes is idempotent, rotates upcoming v1 codes, skips past webinars, and supports dry-run", async () => {
  await withClient(async (client) => {
    const { rotateLegacyWebinarCodes } = await import("../../scripts/rotate-legacy-webinar-codes");
    const { trackWebinarJoin } = await import("@/server/services/webinars");

    const upcomingWebinarId = crypto.randomUUID();
    const pastWebinarId = crypto.randomUUID();

    const futureDate = new Date(Date.now() + 7 * 86400 * 1000);
    const pastDate = new Date(Date.now() - 7 * 86400 * 1000);

    // 1. Seed upcoming webinar
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, published
       ) VALUES
       ($1, $2, 'Webinar Future', 'ندوة مستقبلية', 'Desc', 'وصف', 'Trainer', $3, 60, 'google_meet', 'https://meet.google.com/future', true)`,
      [upcomingWebinarId, `webinar-fut-${upcomingWebinarId.slice(0, 8)}`, futureDate],
    );

    // 2. Seed past webinar
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, published
       ) VALUES
       ($1, $2, 'Webinar Past', 'ندوة ماضية', 'Desc', 'وصف', 'Trainer', $3, 60, 'google_meet', 'https://meet.google.com/past', true)`,
      [pastWebinarId, `webinar-past-${pastWebinarId.slice(0, 8)}`, pastDate],
    );

    const legacyCodeUpcoming = generateAccessCode("MEET");
    const legacyCodePast = generateAccessCode("MEET");

    const upcomingRegId = crypto.randomUUID();
    const pastRegId = crypto.randomUUID();

    await client.query(
      `INSERT INTO "webinar_registrations" (id, webinar_id, status, access_code, access_code_version, registered_at) VALUES
       ($1, $2, 'ACCEPTED', $3, 1, now()),
       ($4, $5, 'ACCEPTED', $6, 1, now())`,
      [
        upcomingRegId,
        upcomingWebinarId,
        hashAccessCode(legacyCodeUpcoming),
        pastRegId,
        pastWebinarId,
        hashAccessCode(legacyCodePast),
      ],
    );

    try {
      // 3. Dry-run execution: detects 1 upcoming registration, applies 0 changes
      const dryResult = await rotateLegacyWebinarCodes({ dryRun: true });
      assert.equal(dryResult.dryRun, true);
      assert.equal(dryResult.rotatedCount, 1);

      const checkDryRow = await client.query(
        `SELECT access_code_version, access_code FROM "webinar_registrations" WHERE id = $1`,
        [upcomingRegId],
      );
      assert.equal(checkDryRow.rows[0].access_code_version, 1, "Dry-run must not mutate database row");

      // 4. Real execution: rotates upcoming webinar registration
      const realResult = await rotateLegacyWebinarCodes({ dryRun: false });
      assert.equal(realResult.dryRun, false);
      assert.equal(realResult.rotatedCount, 1);

      const checkRealUpcoming = await client.query(
        `SELECT access_code_version, access_code FROM "webinar_registrations" WHERE id = $1`,
        [upcomingRegId],
      );
      assert.equal(checkRealUpcoming.rows[0].access_code_version, 2, "Row must be updated to version 2");
      assert.notEqual(checkRealUpcoming.rows[0].access_code, hashAccessCode(legacyCodeUpcoming), "Code must be rotated");

      // 5. Past webinar was NOT rotated (still version 1)
      const checkRealPast = await client.query(
        `SELECT access_code_version, access_code FROM "webinar_registrations" WHERE id = $1`,
        [pastRegId],
      );
      assert.equal(checkRealPast.rows[0].access_code_version, 1, "Past webinar must not be rotated");

      // 6. Idempotency: second real execution finds 0 registrations to rotate
      const idempotentResult = await rotateLegacyWebinarCodes({ dryRun: false });
      assert.equal(idempotentResult.rotatedCount, 0, "Second run must be idempotent (0 rotations)");

      // 7. Joining past webinar with legacy version 1 code is rejected with ACCESS_CODE_EXPIRED
      const pastJoin = await trackWebinarJoin({
        webinarId: pastWebinarId,
        accessCode: legacyCodePast,
      });
      assert.equal(pastJoin.ok, false);
      assert.equal(pastJoin.error, "ACCESS_CODE_EXPIRED");
    } finally {
      await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id IN ($1, $2)`, [
        upcomingWebinarId,
        pastWebinarId,
      ]);
      await client.query(`DELETE FROM "webinars" WHERE id IN ($1, $2)`, [upcomingWebinarId, pastWebinarId]);
    }
  });
});

