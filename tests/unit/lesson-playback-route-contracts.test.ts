/**
 * Contract coverage for src/app/api/lessons/[id]/playback/route.ts and the
 * Phase 8 admin lesson media routes, via source inspection — same pattern
 * (and same "server-only" import constraint) as
 * tests/unit/storage-route-contracts.test.ts. Behavioral entitlement
 * coverage lives in tests/integration/lesson-playback-authorization.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PLAYBACK_ROUTE = "src/app/api/lessons/[id]/playback/route.ts";
const ADMIN_LESSONS_POST = "src/app/api/admin/lessons/route.ts";
const ADMIN_LESSONS_PATCH = "src/app/api/admin/lessons/[id]/route.ts";

test("lesson playback requires an authenticated session, then a valid lesson id, before any entitlement lookup", async () => {
  const source = await readFile(PLAYBACK_ROUTE, "utf8");
  const sessionIndex = source.indexOf("getSession()");
  const unauthorizedIndex = source.indexOf('"UNAUTHORIZED"');
  const idIndex = source.indexOf("idSchema.safeParse");
  const entitlementIndex = source.indexOf("getLessonForPlayback(");
  assert.ok(sessionIndex > -1 && unauthorizedIndex > -1 && idIndex > -1 && entitlementIndex > -1);
  assert.ok(sessionIndex < unauthorizedIndex, "an unauthenticated request must be rejected before any DB lookup");
  assert.ok(unauthorizedIndex < idIndex && idIndex < entitlementIndex, "the lesson id is validated before it is used in the entitlement lookup");
});

test("lesson playback resolves entitlement from the caller's own session user id, never a client-supplied userId", async () => {
  const source = await readFile(PLAYBACK_ROUTE, "utf8");
  assert.equal(source.includes("getLessonForPlayback(session.user.id, id.data)"), true);
  assert.equal(/userId["']?\s*:\s*(?:request|body|params|searchParams)/i.test(source), false, "userId must never be read from the request");
});

test("lesson playback accepts only the lessonId path param — no courseId/organizationId/userId in the request body", async () => {
  const source = await readFile(PLAYBACK_ROUTE, "utf8");
  assert.equal(source.includes("readLimitedJson"), false, "the route takes no request body at all");
  assert.equal(/request\.json\(/.test(source), false);
});

test("lesson playback rejects an unentitled caller before the Cloudflare Stream provider is ever called", async () => {
  const source = await readFile(PLAYBACK_ROUTE, "utf8");
  const entitlementIndex = source.indexOf("getLessonForPlayback(");
  const forbiddenIndex = source.indexOf('"FORBIDDEN"');
  const providerCallIndex = source.indexOf("getStreamPlayback(");
  assert.ok(entitlementIndex > -1 && forbiddenIndex > -1 && providerCallIndex > -1);
  assert.ok(entitlementIndex < forbiddenIndex && forbiddenIndex < providerCallIndex, "no entitlement -> no playback credential");
});

test("lesson playback responses are never publicly cacheable", async () => {
  const source = await readFile(PLAYBACK_ROUTE, "utf8");
  const cacheHeaderCount = (source.match(/private, no-store/g) ?? []).length;
  assert.ok(cacheHeaderCount >= 1, "a shared no-store constant must be applied");
  assert.equal(/public/.test(source), false, "no branch may mark a playback response public");
});

test("lesson playback rate-limits per authenticated user before calling the provider", async () => {
  const source = await readFile(PLAYBACK_ROUTE, "utf8");
  const rateIndex = source.indexOf("consumeRateLimit(");
  const providerCallIndex = source.indexOf("getStreamPlayback(");
  assert.ok(rateIndex > -1 && rateIndex < providerCallIndex);
  assert.match(source, /consumeRateLimit\(`lesson-playback:\$\{session\.user\.id\}`/);
});

test("lesson playback never leaks the raw Cloudflare provider error to the client", async () => {
  const source = await readFile(PLAYBACK_ROUTE, "utf8");
  const catchBlock = source.slice(source.indexOf("} catch (error)"));
  assert.equal(/error\.message|error\.stack|String\(error\)|JSON\.stringify\(error\)/.test(catchBlock), false);
  assert.equal(catchBlock.includes("PLAYBACK_UNAVAILABLE"), true);
});

test("admin lesson media mutations validate a provider-native reference, never accept raw iframe/HTML", async () => {
  const postSource = await readFile(ADMIN_LESSONS_POST, "utf8");
  const patchSource = await readFile(ADMIN_LESSONS_PATCH, "utf8");
  for (const source of [postSource, patchSource]) {
    assert.equal(/dangerouslySetInnerHTML|<iframe/i.test(source), false);
    assert.equal(source.includes("resolveMediaRef("), true);
  }
});

test("admin lesson update requires trusted origin, then admin permission, before any write", async () => {
  const source = await readFile(ADMIN_LESSONS_PATCH, "utf8");
  const originIndex = source.indexOf("isTrustedMutation(request)");
  const sessionIndex = source.indexOf('getAdminSessionFor("courses.update")');
  const rateIndex = source.indexOf("adminMutationRateLimit(");
  const updateIndex = source.indexOf("tx.update(lessons)");
  assert.ok(originIndex > -1 && sessionIndex > -1 && rateIndex > -1 && updateIndex > -1);
  assert.ok(originIndex < sessionIndex && sessionIndex < rateIndex && rateIndex < updateIndex);
});

test("admin lesson media changes are audited", async () => {
  const source = await readFile(ADMIN_LESSONS_PATCH, "utf8");
  assert.equal(source.includes('action: "lesson.update"'), true);
  assert.equal(source.includes("auditLogs"), true);
});
