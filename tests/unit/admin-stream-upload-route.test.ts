import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const STREAM_UPLOAD_ROUTE = "src/app/api/admin/media/stream-upload-url/route.ts";
const MOCK_STREAM_ROUTE = "src/app/api/admin/media/mock-stream-upload/route.ts";

test("admin stream upload url route requires trusted origin before any session check", async () => {
  const source = await readFile(STREAM_UPLOAD_ROUTE, "utf8");
  const originIndex = source.indexOf("isTrustedMutation(request)");
  const sessionIndex = source.indexOf('getAdminSessionFor("courses.update")');
  assert.ok(originIndex > -1 && sessionIndex > -1, "both origin and session checks must exist");
  assert.ok(originIndex < sessionIndex, "trusted origin must be verified before looking up session");
});

test("admin stream upload url route requires admin courses.update permission", async () => {
  const source = await readFile(STREAM_UPLOAD_ROUTE, "utf8");
  assert.ok(source.includes('getAdminSessionFor("courses.update")'));
  assert.ok(source.includes('"FORBIDDEN"'));
});

test("admin stream upload url route rate-limits per admin user", async () => {
  const source = await readFile(STREAM_UPLOAD_ROUTE, "utf8");
  const sessionIndex = source.indexOf('getAdminSessionFor("courses.update")');
  const rateIndex = source.indexOf("adminMutationRateLimit(session.user.id)");
  assert.ok(rateIndex > -1);
  assert.ok(sessionIndex < rateIndex, "rate limiting is keyed by the authenticated admin user id");
});

test("admin stream upload responses enforce private no-store headers", async () => {
  const source = await readFile(STREAM_UPLOAD_ROUTE, "utf8");
  assert.ok(source.includes('"Cache-Control": "private, no-store"'));
});

test("mock stream upload route enforces origin check, auth, and rate limit", async () => {
  const source = await readFile(MOCK_STREAM_ROUTE, "utf8");
  assert.ok(source.includes("isTrustedMutation(request)"));
  assert.ok(source.includes("getAdminSession()"));
  assert.ok(source.includes("adminMutationRateLimit(session.user.id)"));
});
