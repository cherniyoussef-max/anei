/**
 * Behavioral coverage for the Phase 8 private-playback entitlement boundary
 * (src/server/queries/account.ts::getLessonForPlayback), the single point
 * that resolves course/enrollment from a lessonId — following the real-
 * database pattern in tests/integration/storage-authorization.test.ts.
 * Phase 7 remains the authoritative entitlement source: this function only
 * checks for the presence of an `enrollments` row (any `source`), exactly
 * like getLearningCourse/hasEntitlement.
 */
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

async function seedUser(client: Client, label: string) {
  const userId = crypto.randomUUID();
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, created_at, updated_at) values ($1, $2, $3, true, 'USER', now(), now())`,
    [userId, label, `${label}-${userId}@example.test`],
  );
  return userId;
}

async function seedCourse(client: Client, slug: string) {
  const courseId = crypto.randomUUID();
  await client.query(
    `insert into courses
      (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
       category, level, mode, trainer_name, duration_minutes, price_millimes, published, featured,
       objectives, created_at, updated_at)
     values ($1,$2,'Course','دورة','Sum','ملخص','Desc','وصف','test','beginner','online',
             'ANEI',60,5000,true,false,$3::jsonb,now(),now())`,
    [courseId, slug, JSON.stringify({ fr: [], ar: [] })],
  );
  return courseId;
}

let lessonPosition = 0;

async function seedLesson(client: Client, courseId: string, opts: { preview: boolean; mediaProvider: string; mediaRef: string | null }) {
  const lessonId = crypto.randomUUID();
  lessonPosition += 1;
  await client.query(
    `insert into lessons (id, course_id, position, title_fr, title_ar, preview, media_provider, media_ref, created_at)
     values ($1, $2, $3, 'Leçon', 'درس', $4, $5, $6, now())`,
    [lessonId, courseId, lessonPosition, opts.preview, opts.mediaProvider, opts.mediaRef],
  );
  return lessonId;
}

async function seedEnrollment(client: Client, userId: string, courseId: string, source = "PAYMENT") {
  await client.query(
    `insert into enrollments (id, user_id, course_id, status, progress_percent, source, enrolled_at) values ($1, $2, $3, 'active', 0, $4, now())`,
    [crypto.randomUUID(), userId, courseId, source],
  );
}

const STREAM_UID = "a".repeat(32);

test("private playback entitlement: a paid-enrolled user is entitled to a cloudflare_stream lesson", { skip: !url }, async () => {
  const { getLessonForPlayback } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "paid");
    const courseId = await seedCourse(client, `stream-course-${crypto.randomUUID()}`);
    const lessonId = await seedLesson(client, courseId, { preview: false, mediaProvider: "cloudflare_stream", mediaRef: STREAM_UID });
    await seedEnrollment(client, userId, courseId, "PAYMENT");

    const result = await getLessonForPlayback(userId, lessonId);
    assert.ok(result);
    assert.equal(result!.entitled, true);
    assert.equal(result!.lesson.mediaRef, STREAM_UID);
  });
});

test("private playback entitlement: an ADMIN/TEST_PASS-sourced enrollment grants identical access to a PAYMENT one (Phase 7 source-parity invariant)", { skip: !url }, async () => {
  const { getLessonForPlayback } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "admin-enrolled");
    const courseId = await seedCourse(client, `stream-course-${crypto.randomUUID()}`);
    const lessonId = await seedLesson(client, courseId, { preview: false, mediaProvider: "cloudflare_stream", mediaRef: STREAM_UID });
    await seedEnrollment(client, userId, courseId, "ADMIN");

    const result = await getLessonForPlayback(userId, lessonId);
    assert.equal(result!.entitled, true);
  });
});

test("private playback entitlement: a non-enrolled authenticated user is denied", { skip: !url }, async () => {
  const { getLessonForPlayback } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "not-enrolled");
    const courseId = await seedCourse(client, `stream-course-${crypto.randomUUID()}`);
    const lessonId = await seedLesson(client, courseId, { preview: false, mediaProvider: "cloudflare_stream", mediaRef: STREAM_UID });

    const result = await getLessonForPlayback(userId, lessonId);
    assert.equal(result!.entitled, false);
  });
});

test("private playback entitlement: an unauthenticated caller (userId null) is denied for a non-preview lesson", { skip: !url }, async () => {
  const { getLessonForPlayback } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const courseId = await seedCourse(client, `stream-course-${crypto.randomUUID()}`);
    const lessonId = await seedLesson(client, courseId, { preview: false, mediaProvider: "cloudflare_stream", mediaRef: STREAM_UID });

    const result = await getLessonForPlayback(null, lessonId);
    assert.equal(result!.entitled, false);
  });
});

test("private playback entitlement: enrollment in a different course does not grant access (cross-course IDOR)", { skip: !url }, async () => {
  const { getLessonForPlayback } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "other-course-enrolled");
    const enrolledCourseId = await seedCourse(client, `enrolled-course-${crypto.randomUUID()}`);
    const targetCourseId = await seedCourse(client, `target-course-${crypto.randomUUID()}`);
    const lessonId = await seedLesson(client, targetCourseId, { preview: false, mediaProvider: "cloudflare_stream", mediaRef: STREAM_UID });
    await seedEnrollment(client, userId, enrolledCourseId, "PAYMENT");

    const result = await getLessonForPlayback(userId, lessonId);
    assert.equal(result!.entitled, false);
  });
});

test("private playback entitlement: a preview lesson is entitled even without any enrollment or session (public/free)", { skip: !url }, async () => {
  const { getLessonForPlayback } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const courseId = await seedCourse(client, `preview-course-${crypto.randomUUID()}`);
    const lessonId = await seedLesson(client, courseId, { preview: true, mediaProvider: "youtube", mediaRef: "dQw4w9WgXcQ" });

    const anonymous = await getLessonForPlayback(null, lessonId);
    assert.equal(anonymous!.entitled, true);
  });
});

test("private playback entitlement: a nonexistent lesson id returns null (no info leak)", { skip: !url }, async () => {
  const { getLessonForPlayback } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "lookup-nonexistent");
    const result = await getLessonForPlayback(userId, crypto.randomUUID());
    assert.equal(result, null);
  });
});
