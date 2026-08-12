import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("role route still requires trusted origin, SUPER_ADMIN, and rate limiting", async () => {
  const source = await readFile("src/app/api/admin/users/[id]/role/route.ts", "utf8");
  assert.equal(source.includes("isTrustedMutation(request)"), true);
  assert.equal(source.includes("getSuperAdminSession()"), true);
  assert.equal(source.includes("adminMutationRateLimit(session.user.id)"), true);
  assert.equal(source.includes("CANNOT_DEMOTE_SELF"), true);
  assert.equal(source.includes("pg_advisory_xact_lock"), true);
  assert.equal(source.includes("LAST_SUPER_ADMIN"), true);
  assert.equal(source.includes('action: "user.role.update"'), true);
});

test("role route revokes sessions only after a committed, actual role change", async () => {
  const source = await readFile("src/app/api/admin/users/[id]/role/route.ts", "utf8");
  assert.equal(source.includes("roleChanged: target.role !== parsed.data.role"), true);

  const notFoundIndex = source.indexOf('result.kind === "not_found"');
  const lastSuperAdminIndex = source.indexOf('result.kind === "last_super_admin"');
  const revokeGuardIndex = source.indexOf("if (result.roleChanged)");
  const revokeCallIndex = source.indexOf("revokeUserSessions(id.data)");

  assert.ok(notFoundIndex > -1 && lastSuperAdminIndex > -1 && revokeGuardIndex > -1 && revokeCallIndex > -1);
  // Failure short-circuits (early return) must be checked before revocation runs.
  assert.ok(notFoundIndex < revokeGuardIndex);
  assert.ok(lastSuperAdminIndex < revokeGuardIndex);
  assert.ok(revokeGuardIndex < revokeCallIndex);
});

test("session revocation failure is logged but does not fail the request", async () => {
  const source = await readFile("src/app/api/admin/users/[id]/role/route.ts", "utf8");
  const tryIndex = source.indexOf("try {");
  const revokeCallIndex = source.indexOf("revokeUserSessions(id.data)");
  const catchIndex = source.indexOf("} catch (error)");
  const loggerIndex = source.indexOf("logger.error(\"admin.role_session_revocation_failed\"");
  assert.ok(tryIndex > -1 && tryIndex < revokeCallIndex && revokeCallIndex < catchIndex && catchIndex < loggerIndex);
  // The success response is still returned after the best-effort revocation block.
  assert.equal(source.includes("return NextResponse.json({ user: result.updated });"), true);
});

test("revokeUserSessions uses Better Auth's internal adapter, not raw SQL", async () => {
  const source = await readFile("src/server/auth/session.ts", "utf8");
  assert.equal(source.includes("auth.$context"), true);
  assert.equal(source.includes("internalAdapter.deleteUserSessions(userId)"), true);
  assert.equal(source.includes("drizzle"), false);
});
