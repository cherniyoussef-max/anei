import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("invalidateAdminUserCaches uses SCAN (not blocking KEYS) and UNLINK, and never throws", async () => {
  const source = await readFile("src/server/cache/admin-users.ts", "utf8");
  assert.equal(source.includes("scanIterator"), true);
  assert.equal(source.includes("redis.keys(") || source.includes(".keys("), false, "must not use the blocking KEYS command");
  assert.equal(source.includes("redis.unlink"), true);
  assert.equal(source.includes('MATCH: "admin:users:list:*"') || source.includes("LIST_PATTERN"), true);
  const start = source.indexOf("export async function invalidateAdminUserCaches");
  const body = source.slice(start);
  assert.equal(body.includes("try {"), true);
  assert.equal(body.includes("catch"), true);
  assert.equal(body.includes("logger.error"), true);
});

test("role route invalidates the admin user caches independently of session revocation, only on an actual role change", async () => {
  const source = await readFile("src/app/api/admin/users/[id]/role/route.ts", "utf8");
  assert.equal(source.includes('import { invalidateAdminUserCaches } from "@/server/cache/admin-users"'), true);

  const gateStart = source.indexOf("if (result.roleChanged)");
  assert.ok(gateStart > -1);
  const gateBody = source.slice(gateStart, gateStart + 600);
  assert.equal(gateBody.includes("revokeUserSessions"), true);
  assert.equal(gateBody.includes("invalidateAdminUserCaches(id.data)"), true);

  // invalidateAdminUserCaches must be awaited outside the revocation try/catch,
  // so a revocation failure can never skip cache invalidation (or vice versa).
  const revocationCatchEnd = gateBody.indexOf("}", gateBody.indexOf("catch"));
  const invalidationCallIndex = gateBody.indexOf("invalidateAdminUserCaches(id.data)");
  assert.ok(invalidationCallIndex > revocationCatchEnd);
});
