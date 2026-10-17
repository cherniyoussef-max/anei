import test from "node:test";
import assert from "node:assert/strict";
import { adminPermissions, hasAdminPermission } from "../../src/modules/admin/domain/permissions";

test("USER receives no admin capability", () => {
  for (const permission of adminPermissions) assert.equal(hasAdminPermission("USER", permission), false);
});

test("ADMIN receives explicit operational capabilities but not privileged changes", () => {
  assert.equal(hasAdminPermission("ADMIN", "users.read"), true);
  assert.equal(hasAdminPermission("ADMIN", "payments.reconcile"), true);
  assert.equal(hasAdminPermission("ADMIN", "users.role.change"), false);
  assert.equal(hasAdminPermission("ADMIN", "courses.delete"), false);
});

test("SUPER_ADMIN receives every capability", () => {
  for (const permission of adminPermissions) assert.equal(hasAdminPermission("SUPER_ADMIN", permission), true);
});

test("persona management (approve/reject/suspend/reactivate) is granted to ADMIN, unlike privileged role changes", () => {
  // Deliberate: a persona is not a security role (see docs/premium/ARCHITECTURE.md
  // §2), so its lifecycle is an operational capability like users.manage, not a
  // privilege-escalation action reserved for SUPER_ADMIN like users.role.change.
  assert.equal(hasAdminPermission("ADMIN", "personas.manage"), true);
  assert.equal(hasAdminPermission("USER", "personas.manage"), false);
});

test("live.manage is granted to ADMIN and SUPER_ADMIN, while live.broadcast.global is granted exclusively to SUPER_ADMIN", () => {
  assert.equal(hasAdminPermission("ADMIN", "live.manage"), true);
  assert.equal(hasAdminPermission("SUPER_ADMIN", "live.manage"), true);
  assert.equal(hasAdminPermission("USER", "live.manage"), false);

  assert.equal(hasAdminPermission("SUPER_ADMIN", "live.broadcast.global"), true);
  assert.equal(hasAdminPermission("ADMIN", "live.broadcast.global"), false);
  assert.equal(hasAdminPermission("USER", "live.broadcast.global"), false);
});
