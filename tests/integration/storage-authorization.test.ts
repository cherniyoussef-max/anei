/**
 * Behavioral coverage for the private storage authorization boundary
 * (src/server/storage/index.ts, src/server/queries/account.ts,
 * src/server/queries/catalog.ts), following the real-database pattern in
 * tests/integration/checkout-service.test.ts.
 *
 * signedDownloadUrl/signedMediaUrl/signedUploadUrl only compute a local
 * SigV4 signature (no network call to the object store), so they are
 * exercised directly against a fake but well-formed S3-compatible config —
 * this proves the authorization/validation boundary without requiring a
 * MinIO/S3 test service, per the task's "stub deterministically" guidance.
 *
 * The tested modules are imported dynamically (not statically) inside each
 * test so the process.env assignments below land before src/server/env.ts
 * parses process.env at module-load time — static ESM imports would
 * otherwise be hoisted ahead of those assignments (same constraint as
 * tests/integration/flouci-webhook.test.ts).
 */
process.env.STORAGE_PROVIDER = "s3-compatible";
process.env.STORAGE_BUCKET = "anei-test-bucket";
process.env.STORAGE_REGION = "us-east-1";
process.env.STORAGE_ACCESS_KEY_ID = "test-access-key-id";
process.env.STORAGE_SECRET_ACCESS_KEY = "test-secret-access-key";

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

async function seedResource(client: Client, downloadUrl: string | null) {
  const resourceId = crypto.randomUUID();
  await client.query(
    `insert into resources
      (id, slug, title_fr, title_ar, description_fr, description_ar, audience_fr, audience_ar, type, price_millimes, download_url, published, created_at)
     values ($1, $2, 'Guide', 'دليل', 'desc', 'وصف', 'public', 'الجمهور', 'Guide PDF', 5000, $3, true, now())`,
    [resourceId, `storage-authz-resource-${resourceId}`, downloadUrl],
  );
  return resourceId;
}

async function seedOrderAndPurchase(client: Client, userId: string, resourceId: string) {
  const orderId = crypto.randomUUID();
  await client.query(
    `insert into orders (id, user_id, item_type, item_id, item_label, amount_millimes, status, provider, idempotency_key, created_at, updated_at)
     values ($1, $2, 'resource', $3, 'Item', 5000, 'paid', 'mock', $4, now(), now())`,
    [orderId, userId, resourceId, crypto.randomUUID()],
  );
  await client.query(
    `insert into purchases (id, user_id, order_id, resource_id, granted_at) values ($1, $2, $3, $4, now())`,
    [crypto.randomUUID(), userId, orderId, resourceId],
  );
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

async function seedLesson(client: Client, courseId: string, opts: { preview: boolean; videoUrl: string; documentUrl?: string }) {
  const lessonId = crypto.randomUUID();
  lessonPosition += 1;
  await client.query(
    `insert into lessons (id, course_id, position, title_fr, title_ar, video_url, document_url, preview, created_at)
     values ($1, $2, $3, 'Leçon', 'درس', $4, $5, $6, now())`,
    [lessonId, courseId, lessonPosition, opts.videoUrl, opts.documentUrl ?? null, opts.preview],
  );
  return lessonId;
}

async function seedEnrollment(client: Client, userId: string, courseId: string) {
  await client.query(
    `insert into enrollments (id, user_id, course_id, status, progress_percent, enrolled_at) values ($1, $2, $3, 'active', 0, now())`,
    [crypto.randomUUID(), userId, courseId],
  );
}

// --- signing helpers: key validation, TTL, and upload namespace/type constraints ---

test("signedDownloadUrl and signedMediaUrl reject a full URL passed as an object key", async () => {
  const { signedDownloadUrl, signedMediaUrl } = await import("../../src/server/storage");
  for (const bad of ["https://evil.example/leak.pdf", "http://evil.example/leak.pdf"]) {
    await assert.rejects(() => signedDownloadUrl(bad, "file.pdf"), /INVALID_PRIVATE_OBJECT_KEY/);
    await assert.rejects(() => signedMediaUrl(bad), /INVALID_PRIVATE_OBJECT_KEY/);
  }
});

test("signedMediaUrl also rejects an absolute local path (only a private object key is accepted)", async () => {
  const { signedMediaUrl } = await import("../../src/server/storage");
  await assert.rejects(() => signedMediaUrl("/etc/passwd"), /INVALID_PRIVATE_OBJECT_KEY/);
});

test("signedDownloadUrl and signedMediaUrl reject an empty object key", async () => {
  const { signedDownloadUrl, signedMediaUrl } = await import("../../src/server/storage");
  await assert.rejects(() => signedDownloadUrl("", "file.pdf"), /INVALID_PRIVATE_OBJECT_KEY/);
  await assert.rejects(() => signedMediaUrl(""), /INVALID_PRIVATE_OBJECT_KEY/);
});

test("a signed download URL is scoped to the configured bucket, the given object key, and the configured TTL", async () => {
  const { signedDownloadUrl } = await import("../../src/server/storage");
  const signedUrl = await signedDownloadUrl("resource/2026-01-01/abc.pdf", "My File.pdf");
  const parsed = new URL(signedUrl);
  assert.equal(parsed.hostname.includes("anei-test-bucket"), true);
  assert.equal(decodeURIComponent(parsed.pathname).includes("resource/2026-01-01/abc.pdf"), true);
  assert.equal(parsed.searchParams.get("X-Amz-Expires"), "300");
});

test("a signed media URL uses the configured (longer) inline-playback TTL, distinct from the download TTL", async () => {
  const { signedMediaUrl } = await import("../../src/server/storage");
  const signedUrl = await signedMediaUrl("course/2026-01-01/lesson.mp4");
  const parsed = new URL(signedUrl);
  assert.equal(parsed.searchParams.get("X-Amz-Expires"), "7200");
  assert.equal(parsed.searchParams.get("response-content-disposition"), "inline");
});

test("validateUpload rejects a disallowed content type and an oversized declared length", async () => {
  const { validateUpload } = await import("../../src/server/storage");
  assert.throws(() => validateUpload({ contentType: "application/x-msdownload", contentLength: 1000 }), /UNSUPPORTED_MEDIA_TYPE/);
  assert.throws(() => validateUpload({ contentType: "image/png", contentLength: 26 * 1024 * 1024 }), /INVALID_FILE_SIZE/);
  assert.throws(() => validateUpload({ contentType: "image/png", contentLength: 0 }), /INVALID_FILE_SIZE/);
});

test("signedUploadUrl always generates a server-controlled key inside the requested category namespace; the caller cannot choose the key or destination", async () => {
  const { signedUploadUrl } = await import("../../src/server/storage");
  const upload = await signedUploadUrl({ category: "resource", contentType: "application/pdf", contentLength: 1024 });
  assert.match(upload.objectKey, /^resource\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.pdf$/);
  assert.equal(upload.uploadUrl.includes("anei-test-bucket"), true);
  assert.equal(upload.fields["key"], upload.objectKey, "the POST policy pins the object key server-side");
  assert.equal(upload.fields["Content-Type"], "application/pdf");
  assert.equal(upload.expiresInSeconds, 300);
});

test("two uploads in the same category never collide on the generated key (random per-upload, not caller-influenced)", async () => {
  const { signedUploadUrl } = await import("../../src/server/storage");
  const a = await signedUploadUrl({ category: "course", contentType: "video/mp4", contentLength: 1024 });
  const b = await signedUploadUrl({ category: "course", contentType: "video/mp4", contentLength: 1024 });
  assert.notEqual(a.objectKey, b.objectKey);
});

// --- resource download entitlement (getPurchasedResourceForDownload) ---

test("resource download entitlement: an authenticated user with no purchase gets no resource (no signed URL can be produced)", { skip: !url }, async () => {
  const { getPurchasedResourceForDownload } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "no-purchase");
    const resourceId = await seedResource(client, "resource/2026-01-01/private.pdf");
    const resource = await getPurchasedResourceForDownload(userId, resourceId);
    assert.equal(resource, undefined);
  });
});

test("resource download entitlement: the purchasing user receives the resource row (and can be signed)", { skip: !url }, async () => {
  const { getPurchasedResourceForDownload } = await import("../../src/server/queries/account");
  const { signedDownloadUrl } = await import("../../src/server/storage");
  await withClient(async (client) => {
    const userId = await seedUser(client, "purchaser");
    const resourceId = await seedResource(client, "resource/2026-01-01/private.pdf");
    await seedOrderAndPurchase(client, userId, resourceId);
    const resource = await getPurchasedResourceForDownload(userId, resourceId);
    assert.ok(resource);
    assert.equal(resource!.id, resourceId);
    const signedUrl = await signedDownloadUrl(resource!.downloadUrl!, `${resource!.slug}.pdf`);
    assert.match(signedUrl, /^https:\/\//);
  });
});

test("resource download entitlement: a different user cannot obtain another user's purchased resource by supplying its id (IDOR)", { skip: !url }, async () => {
  const { getPurchasedResourceForDownload } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const owner = await seedUser(client, "owner");
    const attacker = await seedUser(client, "attacker");
    const resourceId = await seedResource(client, "resource/2026-01-01/private.pdf");
    await seedOrderAndPurchase(client, owner, resourceId);

    const asOwner = await getPurchasedResourceForDownload(owner, resourceId);
    const asAttacker = await getPurchasedResourceForDownload(attacker, resourceId);
    assert.ok(asOwner);
    assert.equal(asAttacker, undefined);
  });
});

test("resource download entitlement: a nonexistent resource id is handled safely (undefined, no throw, no info leak)", { skip: !url }, async () => {
  const { getPurchasedResourceForDownload } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "nonexistent-lookup");
    const resource = await getPurchasedResourceForDownload(userId, crypto.randomUUID());
    assert.equal(resource, undefined);
  });
});

// --- course media entitlement (getLearningCourse / getPublishedCourse) ---

test("course media entitlement: an enrolled user's lesson video/document are resolved to signed URLs", { skip: !url }, async () => {
  const { getLearningCourse } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "enrolled");
    const courseId = await seedCourse(client, `learn-course-${crypto.randomUUID()}`);
    await seedLesson(client, courseId, { preview: false, videoUrl: "course/2026-01-01/lesson.mp4", documentUrl: "course/2026-01-01/notes.pdf" });
    await seedEnrollment(client, userId, courseId);

    const course = await client.query(`select slug from courses where id = $1`, [courseId]);
    const data = await getLearningCourse(userId, course.rows[0].slug);
    assert.ok(data);
    assert.equal(data!.lessons.length, 1);
    assert.match(data!.lessons[0].videoUrl!, /^https:\/\//);
    assert.match(data!.lessons[0].documentUrl!, /^https:\/\//);
  });
});

test("course media entitlement: a non-enrolled authenticated user gets no course/lesson data at all (no signed URL is ever produced)", { skip: !url }, async () => {
  const { getLearningCourse } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const userId = await seedUser(client, "not-enrolled");
    const courseId = await seedCourse(client, `learn-course-${crypto.randomUUID()}`);
    await seedLesson(client, courseId, { preview: false, videoUrl: "course/2026-01-01/lesson.mp4" });

    const course = await client.query(`select slug from courses where id = $1`, [courseId]);
    const data = await getLearningCourse(userId, course.rows[0].slug);
    assert.equal(data, null);
  });
});

test("course media entitlement: enrollment is scoped per user — another user's enrollment does not grant access", { skip: !url }, async () => {
  const { getLearningCourse } = await import("../../src/server/queries/account");
  await withClient(async (client) => {
    const enrolledUser = await seedUser(client, "enrolled-2");
    const otherUser = await seedUser(client, "other-2");
    const courseId = await seedCourse(client, `learn-course-${crypto.randomUUID()}`);
    await seedLesson(client, courseId, { preview: false, videoUrl: "course/2026-01-01/lesson.mp4" });
    await seedEnrollment(client, enrolledUser, courseId);

    const course = await client.query(`select slug from courses where id = $1`, [courseId]);
    const asEnrolled = await getLearningCourse(enrolledUser, course.rows[0].slug);
    const asOther = await getLearningCourse(otherUser, course.rows[0].slug);
    assert.ok(asEnrolled);
    assert.equal(asOther, null);
  });
});

test("public course preview: only preview lessons get a signed media URL, and document URLs are never exposed publicly regardless of entitlement", { skip: !url }, async () => {
  const { getPublishedCourse } = await import("../../src/server/queries/catalog");
  await withClient(async (client) => {
    const courseId = await seedCourse(client, `public-course-${crypto.randomUUID()}`);
    await seedLesson(client, courseId, { preview: true, videoUrl: "course/2026-01-01/preview.mp4", documentUrl: "course/2026-01-01/full-notes.pdf" });
    await seedLesson(client, courseId, { preview: false, videoUrl: "course/2026-01-01/full-lesson.mp4" });

    const course = await client.query(`select slug from courses where id = $1`, [courseId]);
    const data = await getPublishedCourse(course.rows[0].slug);
    assert.ok(data);
    const preview = data!.lessons.find((l) => l.preview);
    const gated = data!.lessons.find((l) => !l.preview);
    assert.match(preview!.videoUrl!, /^https:\/\//, "the preview lesson's video should be signed for public playback");
    assert.equal(preview!.documentUrl, null, "documents are never signed on the public catalog path, even for a preview lesson");
    assert.equal(gated!.videoUrl, null, "a non-preview lesson's video must never be signed on the public catalog path");
  });
});
