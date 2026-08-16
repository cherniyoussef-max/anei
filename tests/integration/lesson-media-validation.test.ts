/**
 * Behavioral coverage for the Phase 8 media provider validation boundary
 * (src/server/media/youtube.ts, src/server/media/cloudflare-stream.ts,
 * src/server/services/lesson-media.ts). These modules are `import
 * "server-only"`, so — matching tests/integration/storage-authorization.test.ts's
 * documented constraint — they are imported dynamically under Next.js'
 * react-server condition (test:integration), not tests/unit.
 */
import test from "node:test";
import assert from "node:assert/strict";

test("canonicalYoutubeId accepts a bare id and the allowed youtube.com/youtu.be URL forms", async () => {
  const { canonicalYoutubeId } = await import("../../src/server/media/youtube");
  assert.equal(canonicalYoutubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(canonicalYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(canonicalYoutubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(canonicalYoutubeId("https://youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("canonicalYoutubeId rejects malicious or unrelated-origin values (never becomes an iframe src)", async () => {
  const { canonicalYoutubeId } = await import("../../src/server/media/youtube");
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "<iframe src=x></iframe>",
    "not-a-video-id",
    "",
  ]) {
    assert.equal(canonicalYoutubeId(bad), null, bad);
  }
});

test("isValidStreamUid only accepts a bounded 32-char lowercase hex Cloudflare Stream uid", async () => {
  const { isValidStreamUid } = await import("../../src/server/media/cloudflare-stream");
  assert.equal(isValidStreamUid("a".repeat(32)), true);
  assert.equal(isValidStreamUid("A".repeat(32)), false, "uppercase is not the Cloudflare uid format");
  assert.equal(isValidStreamUid("a".repeat(31)), false);
  assert.equal(isValidStreamUid("a".repeat(33)), false);
  assert.equal(isValidStreamUid("<script>alert(1)</script>"), false);
});

test("resolveMediaRef: internal provider always stores null (existing videoUrl path untouched)", async () => {
  const { resolveMediaRef } = await import("../../src/server/services/lesson-media");
  assert.equal(resolveMediaRef("internal", "anything", false), null);
  assert.equal(resolveMediaRef("internal", null, true), null);
});

test("resolveMediaRef: YouTube is rejected unless the lesson is marked preview (public/free rule enforced server-side)", async () => {
  const { resolveMediaRef } = await import("../../src/server/services/lesson-media");
  const { InvalidLessonMediaError } = await import("../../src/server/services/lesson-media");
  assert.throws(() => resolveMediaRef("youtube", "dQw4w9WgXcQ", false), InvalidLessonMediaError);
  assert.equal(resolveMediaRef("youtube", "dQw4w9WgXcQ", true), "dQw4w9WgXcQ");
});

test("resolveMediaRef: an invalid YouTube reference (malicious URL) is rejected even for a preview lesson", async () => {
  const { resolveMediaRef, InvalidLessonMediaError } = await import("../../src/server/services/lesson-media");
  assert.throws(() => resolveMediaRef("youtube", "javascript:alert(1)", true), InvalidLessonMediaError);
});

test("resolveMediaRef: cloudflare_stream requires a well-formed uid, independent of preview", async () => {
  const { resolveMediaRef, InvalidLessonMediaError } = await import("../../src/server/services/lesson-media");
  assert.throws(() => resolveMediaRef("cloudflare_stream", "not-a-uid", false), InvalidLessonMediaError);
  assert.equal(resolveMediaRef("cloudflare_stream", "a".repeat(32), false), "a".repeat(32));
});

test("resolveMediaRef: a non-internal provider requires a mediaRef", async () => {
  const { resolveMediaRef, InvalidLessonMediaError } = await import("../../src/server/services/lesson-media");
  assert.throws(() => resolveMediaRef("youtube", null, true), InvalidLessonMediaError);
  assert.throws(() => resolveMediaRef("cloudflare_stream", "", false), InvalidLessonMediaError);
});

test("getStreamPlayback fails closed (MediaConfigurationError) when Cloudflare Stream env vars are absent", async () => {
  const { getStreamPlayback, MediaConfigurationError } = await import("../../src/server/media/cloudflare-stream");
  await assert.rejects(() => getStreamPlayback("a".repeat(32)), MediaConfigurationError);
});
