import test from "node:test";
import assert from "node:assert/strict";
import { calculateChildAge } from "../../src/server/queries/care-relationships";
import {
  adminPermissions,
  hasAdminPermission,
} from "../../src/modules/admin/domain/permissions";

test("calculateChildAge: accurately computes age from birthDate", () => {
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  assert.equal(calculateChildAge(tenYearsAgo, null), 10);

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  assert.equal(calculateChildAge(fiveYearsAgo, null), 5);
});

test("calculateChildAge: falls back to birthYear when birthDate is null", () => {
  const currentYear = new Date().getFullYear();
  assert.equal(calculateChildAge(null, currentYear - 8), 8);
  assert.equal(calculateChildAge(null, currentYear - 14), 14);
});

test("calculateChildAge: returns null when neither birthDate nor birthYear is provided", () => {
  assert.equal(calculateChildAge(null, null), null);
  assert.equal(calculateChildAge(undefined, undefined), null);
});

test("calculateChildAge: handles edge cases gracefully", () => {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 2);
  assert.equal(calculateChildAge(futureDate, null), 0);
});

test("adminPermissions: care.relationships.manage is registered and granted to ADMIN and SUPER_ADMIN", () => {
  assert.ok(adminPermissions.includes("care.relationships.manage"));
  assert.equal(hasAdminPermission("SUPER_ADMIN", "care.relationships.manage"), true);
  assert.equal(hasAdminPermission("ADMIN", "care.relationships.manage"), true);
  assert.equal(hasAdminPermission("USER", "care.relationships.manage"), false);
  assert.equal(hasAdminPermission(null, "care.relationships.manage"), false);
});
