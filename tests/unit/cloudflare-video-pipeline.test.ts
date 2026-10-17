import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  isValidStreamUid,
  verifyStreamWebhookSignature,
} from "@/server/media/cloudflare-stream";

test("isValidStreamUid validates 32-character hex Cloudflare Stream UIDs", () => {
  const validUid = "0123456789abcdef0123456789abcdef";
  assert.equal(isValidStreamUid(validUid), true);

  // Invalid cases
  assert.equal(isValidStreamUid(""), false);
  assert.equal(isValidStreamUid("short-uid"), false);
  assert.equal(isValidStreamUid("0123456789abcdef0123456789abcdeg"), false); // 'g' is not hex
  assert.equal(isValidStreamUid("0123456789abcdef0123456789abcdef00"), false); // too long
  assert.equal(isValidStreamUid("../../../etc/passwd"), false);
});

test("verifyStreamWebhookSignature verifies Cloudflare Stream HMAC-SHA256 signatures", () => {
  const secret = "test_webhook_secret_key_123456789";
  const rawBody = JSON.stringify({
    uid: "0123456789abcdef0123456789abcdef",
    readyToStream: true,
    status: { state: "ready", pctComplete: "100.000000" },
    duration: 720,
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const header = `time=${timestamp},sig1=${signature}`;

  // Valid signature
  assert.equal(verifyStreamWebhookSignature(rawBody, header, secret), true);

  // Tampered payload
  const tamperedBody = JSON.stringify({ ...JSON.parse(rawBody), duration: 999 });
  assert.equal(verifyStreamWebhookSignature(tamperedBody, header, secret), false);

  // Tampered signature
  const fakeHeader = `time=${timestamp},sig1=${signature.replace(/a/g, "b")}`;
  assert.equal(verifyStreamWebhookSignature(rawBody, fakeHeader, secret), false);

  // Tampered timestamp
  const fakeTimeHeader = `time=${Number(timestamp) + 100},sig1=${signature}`;
  assert.equal(verifyStreamWebhookSignature(rawBody, fakeTimeHeader, secret), false);

  // Missing or empty header
  assert.equal(verifyStreamWebhookSignature(rawBody, null, secret), false);
  assert.equal(verifyStreamWebhookSignature(rawBody, "", secret), false);
});

test("Video upload URL route enforces strict security checks", async () => {
  const route = await readFile("src/app/api/admin/media/video/upload-url/route.ts", "utf8");
  assert.ok(route.includes("isTrustedMutation(request)"), "Must verify trusted mutation");
  assert.ok(route.includes('getAdminSessionFor("courses.update")'), "Must require admin courses.update permission");
  assert.ok(route.includes("adminMutationRateLimit(session.user.id)"), "Must rate limit by admin user id");
  assert.ok(route.includes('"Cache-Control": "private, no-store"'), "Must disable caching with private, no-store");
  assert.ok(route.includes("createDirectUploadSession"), "Must invoke createDirectUploadSession");
});

test("Video asset status polling route enforces admin authorization and no-store", async () => {
  const route = await readFile("src/app/api/admin/media/video/[assetId]/status/route.ts", "utf8");
  assert.ok(route.includes('getAdminSessionFor("courses.update")'), "Must require admin permission");
  assert.ok(route.includes("z.string().uuid().safeParse(assetId)"), "Must validate UUID assetId");
  assert.ok(route.includes("syncVideoAssetStatus"), "Must invoke syncVideoAssetStatus");
  assert.ok(route.includes('"Cache-Control": "private, no-store"'), "Must enforce private, no-store");
});

test("Cloudflare Stream webhook route checks signature and updates database", async () => {
  const route = await readFile("src/app/api/webhooks/cloudflare-stream/route.ts", "utf8");
  assert.ok(route.includes("verifyStreamWebhookSignature"), "Must verify webhook signature");
  assert.ok(route.includes("syncVideoAssetStatus"), "Must call syncVideoAssetStatus on webhook event");
  assert.ok(route.includes("Webhook-Signature"), "Must read Webhook-Signature header");
});

test("Learner video playback route validates entitlement, rate limits, and issues signed playback", async () => {
  const route = await readFile("src/app/api/learning/video/[lessonId]/playback/route.ts", "utf8");
  assert.ok(route.includes("getSession()"), "Must fetch authenticated session");
  assert.ok(route.includes("getLessonForPlayback"), "Must check lesson entitlement");
  assert.ok(route.includes("consumeRateLimit"), "Must rate limit playback requests");
  assert.ok(route.includes("generateSignedPlaybackToken"), "Must issue signed token");
  assert.ok(route.includes("iframeUrl"), "Must return secure iframeUrl");
});
