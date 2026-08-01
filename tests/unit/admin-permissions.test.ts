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
