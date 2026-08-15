import test from "node:test";
import assert from "node:assert/strict";
import {
  organizationRoles,
  organizationRoleAtLeast,
  parentRelationshipTypes,
  parentLinkStatuses,
  assignmentStatuses,
} from "../../src/modules/relationships/domain/permissions";

test("organizationRoleAtLeast: OWNER outranks every role, VIEWER outranks none", () => {
  for (const role of organizationRoles) assert.equal(organizationRoleAtLeast("OWNER", role), true);
  for (const minRole of organizationRoles) {
    assert.equal(organizationRoleAtLeast("VIEWER", minRole), minRole === "VIEWER");
  }
});

test("organizationRoleAtLeast: rank order is VIEWER < STAFF < MANAGER < OWNER", () => {
  assert.equal(organizationRoleAtLeast("STAFF", "VIEWER"), true);
  assert.equal(organizationRoleAtLeast("VIEWER", "STAFF"), false);
  assert.equal(organizationRoleAtLeast("MANAGER", "STAFF"), true);
  assert.equal(organizationRoleAtLeast("STAFF", "MANAGER"), false);
  assert.equal(organizationRoleAtLeast("OWNER", "MANAGER"), true);
  assert.equal(organizationRoleAtLeast("MANAGER", "OWNER"), false);
});

test("organizationRoleAtLeast: a role always satisfies itself as the minimum", () => {
  for (const role of organizationRoles) assert.equal(organizationRoleAtLeast(role, role), true);
});

test("canonical value sets never overlap with unrelated persona/status vocabularies", () => {
  assert.deepEqual([...organizationRoles], ["OWNER", "MANAGER", "STAFF", "VIEWER"]);
  assert.deepEqual([...parentRelationshipTypes], ["MOTHER", "FATHER", "GUARDIAN", "OTHER"]);
  assert.deepEqual([...parentLinkStatuses], ["PENDING", "ACTIVE", "REVOKED"]);
  assert.deepEqual([...assignmentStatuses], ["ACTIVE", "ENDED"]);
});
