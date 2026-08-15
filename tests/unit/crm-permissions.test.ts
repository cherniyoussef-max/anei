import test from "node:test";
import assert from "node:assert/strict";
import { canManageCrmContacts, canManageCrmPipelines } from "../../src/modules/crm/domain/permissions";
import { adminPermissions, hasAdminPermission } from "../../src/modules/admin/domain/permissions";

test("VIEWER cannot manage CRM contacts or pipelines", () => {
  assert.equal(canManageCrmContacts("VIEWER"), false);
  assert.equal(canManageCrmPipelines("VIEWER"), false);
});

test("STAFF can manage CRM contacts but not pipelines", () => {
  assert.equal(canManageCrmContacts("STAFF"), true);
  assert.equal(canManageCrmPipelines("STAFF"), false);
});

test("MANAGER and OWNER can manage both contacts and pipelines", () => {
  assert.equal(canManageCrmContacts("MANAGER"), true);
  assert.equal(canManageCrmPipelines("MANAGER"), true);
  assert.equal(canManageCrmContacts("OWNER"), true);
  assert.equal(canManageCrmPipelines("OWNER"), true);
});

test("adminPermissions declares crm.read and crm.manage", () => {
  assert.ok(adminPermissions.includes("crm.read"));
  assert.ok(adminPermissions.includes("crm.manage"));
});

test("platform ADMIN receives operational CRM capability, USER receives none, SUPER_ADMIN receives all", () => {
  assert.equal(hasAdminPermission("ADMIN", "crm.read"), true);
  assert.equal(hasAdminPermission("ADMIN", "crm.manage"), true);
  assert.equal(hasAdminPermission("USER", "crm.read"), false);
  assert.equal(hasAdminPermission("USER", "crm.manage"), false);
  assert.equal(hasAdminPermission("SUPER_ADMIN", "crm.read"), true);
  assert.equal(hasAdminPermission("SUPER_ADMIN", "crm.manage"), true);
});
