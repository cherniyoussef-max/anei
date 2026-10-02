import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import { generateAccessCode, hashAccessCode } from "@/lib/webinars";
import { consumeRateLimit, setRateLimitRedisResolverForTests } from "@/server/security/rate-limit";

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

test("Item 2 Security: Guest access codes CSPRNG entropy and hashing", () => {
  // 1. Generation: 128-bit CSPRNG entropy
  const codes = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const code = generateAccessCode();
    assert.match(code, /^MEET-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
    codes.add(code);
  }
  // Verify 500 distinct codes (no collisions)
  assert.equal(codes.size, 500, "500 randomly generated codes must be unique");

  // 2. Storage: deterministic SHA-256 hash
  const raw = "MEET-11223344-55667788-99AABBCC-DDEEFF00";
  const hashed = hashAccessCode(raw);
  assert.equal(hashed.length, 64, "SHA-256 hash must be 64 hex characters");
  assert.equal(hashed, crypto.createHash("sha256").update(raw).digest("hex"));
});

test("Item 2 Security: trackWebinarJoin enforces binding, hashed storage, constant-time compare, expiry, and revocation", async () => {
  await withClient(async (client) => {
    const { trackWebinarJoin } = await import("../../src/server/services/webinars");

    const webinarAId = crypto.randomUUID();
    const webinarBId = crypto.randomUUID();
    const expiredWebinarId = crypto.randomUUID();
    const inPersonWebinarId = crypto.randomUUID();

    const expectedMeetingUrl = "https://meet.google.com/test-guest-code";

    // 1. Seed webinars
    // Active online webinar A
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, replay_url, published
       ) VALUES
       ($1, $2, 'Webinar A', 'ندوة أ', 'Desc', 'وصف', 'Trainer', now(), 60, 'google_meet', $3, null, true)`,
      [webinarAId, `webinar-a-${webinarAId.slice(0, 8)}`, expectedMeetingUrl],
    );

    // Active online webinar B
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, replay_url, published
       ) VALUES
       ($1, $2, 'Webinar B', 'ندوة ب', 'Desc', 'وصف', 'Trainer', now(), 60, 'google_meet', 'https://meet.google.com/other', null, true)`,
      [webinarBId, `webinar-b-${webinarBId.slice(0, 8)}`],
    );

    // Expired webinar (ended 80 hours ago, past 72h window)
    const eightyHoursAgo = new Date(Date.now() - 80 * 3600 * 1000);
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, replay_url, published
       ) VALUES
       ($1, $2, 'Webinar Expired', 'ندوة منتهية', 'Desc', 'وصف', 'Trainer', $3, 60, 'google_meet', 'https://meet.google.com/exp', null, true)`,
      [expiredWebinarId, `webinar-exp-${expiredWebinarId.slice(0, 8)}`, eightyHoursAgo],
    );

    // In-person webinar
    await client.query(
      `INSERT INTO "webinars" (
         id, slug, title_fr, title_ar, description_fr, description_ar,
         trainer_name, starts_at, duration_minutes, meeting_provider,
         meeting_url, location, replay_url, published
       ) VALUES
       ($1, $2, 'Webinar In Person', 'ندوة حضورية', 'Desc', 'وصف', 'Trainer', now(), 120, 'in_person', null, 'Centre Urbain Nord, Tunis', null, true)`,
      [inPersonWebinarId, `webinar-inp-${inPersonWebinarId.slice(0, 8)}`],
    );

    // 2. Generate guest codes
    const rawCodeA = generateAccessCode("MEET");
    const hashedCodeA = hashAccessCode(rawCodeA);

    const rawCodeExpired = generateAccessCode("MEET");
    const hashedCodeExpired = hashAccessCode(rawCodeExpired);

    const rawCodeInPerson = generateAccessCode("MEET");
    const hashedCodeInPerson = hashAccessCode(rawCodeInPerson);

    const rawCodeRevoked = generateAccessCode("MEET");
    const hashedCodeRevoked = hashAccessCode(rawCodeRevoked);

    // Seed registrations with HASHED codes
    await client.query(
      `INSERT INTO "webinar_registrations" (id, webinar_id, status, access_code, registered_at) VALUES
       (gen_random_uuid(), $1, 'ACCEPTED', $2, now()),
       (gen_random_uuid(), $3, 'ACCEPTED', $4, now()),
       (gen_random_uuid(), $5, 'ACCEPTED', $6, now()),
       (gen_random_uuid(), $1, 'REJECTED', $7, now())`,
      [
        webinarAId,
        hashedCodeA,
        expiredWebinarId,
        hashedCodeExpired,
        inPersonWebinarId,
        hashedCodeInPerson,
        hashedCodeRevoked,
      ],
    );

    try {
      // Test 2a: Valid guest code for Webinar A succeeds with stored hash
      const validJoin = await trackWebinarJoin({
        webinarId: webinarAId,
        accessCode: rawCodeA,
      });
      assert.equal(validJoin.ok, true);
      assert.equal(validJoin.meetingUrl, expectedMeetingUrl);

      // Test 2b: Webinar Binding - Code for Webinar A used on Webinar B MUST FAIL
      const crossWebinarJoin = await trackWebinarJoin({
        webinarId: webinarBId,
        accessCode: rawCodeA,
      });
      assert.equal(crossWebinarJoin.ok, false);
      assert.equal(crossWebinarJoin.error, "REGISTRATION_REQUIRED");
      assert.equal(crossWebinarJoin.meetingUrl, null);

      // Test 2c: Expiry - Access code for expired webinar (>72h after duration) MUST FAIL
      const expiredJoin = await trackWebinarJoin({
        webinarId: expiredWebinarId,
        accessCode: rawCodeExpired,
      });
      assert.equal(expiredJoin.ok, false);
      assert.equal(expiredJoin.error, "ACCESS_CODE_EXPIRED");
      assert.equal(expiredJoin.meetingUrl, null);

      // Test 2d: Revocation - Rejected registration MUST FAIL
      const revokedJoin = await trackWebinarJoin({
        webinarId: webinarAId,
        accessCode: rawCodeRevoked,
      });
      assert.equal(revokedJoin.ok, false);
      assert.equal(revokedJoin.error, "REJECTED");
      assert.equal(revokedJoin.meetingUrl, null);

      // Test 2e: In-Person session - returns location, meetingUrl MUST be null
      const inPersonJoin = await trackWebinarJoin({
        webinarId: inPersonWebinarId,
        accessCode: rawCodeInPerson,
      });
      assert.equal(inPersonJoin.ok, true);
      assert.equal(inPersonJoin.meetingUrl, null);
      assert.equal(inPersonJoin.location, "Centre Urbain Nord, Tunis");
      assert.equal(inPersonJoin.provider, "in_person");
    } finally {
      // Clean up test data
      await client.query(`DELETE FROM "webinar_registrations" WHERE webinar_id IN ($1, $2, $3, $4)`, [
        webinarAId,
        webinarBId,
        expiredWebinarId,
        inPersonWebinarId,
      ]);
      await client.query(`DELETE FROM "webinars" WHERE id IN ($1, $2, $3, $4)`, [
        webinarAId,
        webinarBId,
        expiredWebinarId,
        inPersonWebinarId,
      ]);
    }
  });
});

test("Item 2 Security: Join endpoint rate limiting and fail-closed behavior", async () => {
  const webinarId = crypto.randomUUID();
  const testIp = "198.51.100.42";
  const rateLimitKey = `webinar-join:${webinarId}:${testIp}`;

  // 1. In-memory normal rate limit allows up to limit
  const first = await consumeRateLimit(rateLimitKey, 3, 60);
  assert.equal(first.allowed, true);

  // 2. Redis outage with failClosedOnOutage=true must immediately reject
  setRateLimitRedisResolverForTests(async () => {
    throw new Error("Simulated Redis outage");
  });

  try {
    const outageResult = await consumeRateLimit(`webinar-join:${webinarId}:different-ip`, 20, 60, {
      failClosedOnOutage: true,
    });
    assert.equal(
      outageResult.allowed,
      false,
      "Redis outage with failClosedOnOutage=true must reject (fail-closed)",
    );
    assert.equal(outageResult.remaining, 0);
  } finally {
    setRateLimitRedisResolverForTests(null);
  }
});

test("Item 2 Security: Join route enforces Referrer-Policy: no-referrer to prevent leak of access codes", async () => {
  const { GET, POST } = await import("../../src/app/api/webinars/[id]/join/route");
  const testId = crypto.randomUUID();

  // GET redirect response
  const getReq = new Request(`https://anei.tn/api/webinars/${testId}/join?code=MEET-TEST`, {
    headers: { "x-forwarded-for": "198.51.100.99" },
  });
  const getRes = await GET(getReq, { params: Promise.resolve({ id: testId }) });
  assert.equal(
    getRes.headers.get("referrer-policy"),
    "no-referrer",
    "GET join redirect response must set Referrer-Policy: no-referrer",
  );

  // POST response
  const postReq = new Request(`https://anei.tn/api/webinars/${testId}/join?code=MEET-TEST`, {
    method: "POST",
    headers: {
      origin: "https://anei.tn",
      "x-forwarded-for": "198.51.100.99",
    },
  });
  const postRes = await POST(postReq, { params: Promise.resolve({ id: testId }) });
  assert.equal(
    postRes.headers.get("referrer-policy"),
    "no-referrer",
    "POST join response must set Referrer-Policy: no-referrer",
  );
});
