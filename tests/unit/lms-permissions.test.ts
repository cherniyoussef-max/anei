import test from "node:test";
import assert from "node:assert/strict";
import {
  canManageCohorts,
  canManageTeacherAssignments,
  cohortStatuses,
  enrollmentSources,
} from "../../src/modules/lms/domain/permissions";

test("role gates: only MANAGER+ manages cohorts and teacher assignments", () => {
  assert.equal(canManageCohorts("VIEWER"), false);
  assert.equal(canManageCohorts("STAFF"), false);
  assert.equal(canManageCohorts("MANAGER"), true);
  assert.equal(canManageCohorts("OWNER"), true);

  assert.equal(canManageTeacherAssignments("VIEWER"), false);
  assert.equal(canManageTeacherAssignments("STAFF"), false);
  assert.equal(canManageTeacherAssignments("MANAGER"), true);
  assert.equal(canManageTeacherAssignments("OWNER"), true);
});

test("cohort statuses and enrollment sources are bounded, explicit allowlists", () => {
  assert.deepEqual(cohortStatuses, ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]);
  assert.deepEqual(enrollmentSources, ["PAYMENT", "TEST_PASS", "ORGANIZATION", "ADMIN", "MANUAL"]);
  // PAYMENT is the pre-Phase-7 default — existing checkout flow must keep working unmodified.
  assert.ok(enrollmentSources.includes("PAYMENT"));
});
