import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROUTE = "src/app/api/admin/users/[id]/reset-password/route.ts";
const CRM_COMPONENT = "src/modules/admin/components/AdminUserCrmActions.tsx";
const ADMIN_USERS_QUERIES = "src/modules/admin/queries/admin-users.ts";

test("password reset route still requires trusted origin, SUPER_ADMIN, and rate limiting", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(source.includes("isTrustedMutation(request)"), true);
  assert.equal(source.includes("getSuperAdminSession()"), true);
  assert.equal(source.includes("adminMutationRateLimit(session.user.id)"), true);
});

test("password reset route resolves the target email from the database, never from the request body", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(/z\.object\(\{\s*locale:/.test(source), true, "request body schema must only accept locale, not email");
  assert.equal(source.includes("db.select({ id: user.id, email: user.email })"), true);
  assert.equal(source.includes("email: target.email"), true);
});

test("password reset route only writes the audit record after the reset email send succeeds", async () => {
  const source = await readFile(ROUTE, "utf8");
  const sendCallIndex = source.indexOf("auth.api.requestPasswordReset(");
  const sendCatchIndex = source.indexOf("RESET_SEND_FAILED");
  const auditInsertIndex = source.indexOf('action: "user.password_reset.initiate"');
  assert.ok(sendCallIndex > -1 && sendCatchIndex > -1 && auditInsertIndex > -1);
  // Send failure must return before the audit insert is ever reached.
  assert.ok(sendCallIndex < sendCatchIndex);
  assert.ok(sendCatchIndex < auditInsertIndex);
});

test("password reset audit entry has correct actor/entity and carries no PII or secrets", async () => {
  const source = await readFile(ROUTE, "utf8");
  const insertStart = source.indexOf("db.insert(auditLogs).values({");
  const insertEnd = source.indexOf("});", insertStart);
  const insertCall = source.slice(insertStart, insertEnd);
  assert.equal(insertCall.includes("actorUserId: session.user.id"), true);
  assert.equal(insertCall.includes('entityType: "user"'), true);
  assert.equal(insertCall.includes("entityId: id.data"), true);
  assert.equal(insertCall.includes("email"), false, "audit metadata must not carry the target's email");
  assert.equal(insertCall.includes("token"), false);
});

test("a failed audit insert after a successful reset send is logged, not silently dropped, and still reports success", async () => {
  const source = await readFile(ROUTE, "utf8");
  const auditTryIndex = source.indexOf("try {\n    await db.insert(auditLogs)");
  const catchIndex = source.indexOf("admin.password_reset_audit_failed");
  const okReturnIndex = source.lastIndexOf('NextResponse.json({ ok: true })');
  assert.ok(auditTryIndex > -1 && catchIndex > -1 && okReturnIndex > -1);
  assert.ok(auditTryIndex < catchIndex);
  assert.ok(catchIndex < okReturnIndex);
});

test("admin CRM component no longer calls Better Auth's client SDK directly for password reset", async () => {
  const source = await readFile(CRM_COMPONENT, "utf8");
  assert.equal(source.includes("authClient"), false);
  assert.equal(source.includes("/api/admin/users/${userId}/reset-password"), true);
});

test("read-only admin user queries do not write audit records", async () => {
  const source = await readFile(ADMIN_USERS_QUERIES, "utf8");
  assert.equal(source.includes("auditLogs"), false);
});
