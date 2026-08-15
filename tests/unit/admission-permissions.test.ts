import test from "node:test";
import assert from "node:assert/strict";
import {
  admissionContactActivityTypes,
  admissionFinalDecisions,
  appointmentSlotConsumingStatuses,
  appointmentStatuses,
  appointmentTransitions,
  canFinalizeAdmission,
  canManageAppointments,
  canManageAssessments,
  canTransitionAppointment,
} from "../../src/modules/admission/domain/permissions";

test("appointment state machine: every non-terminal status may advance, every terminal status is a sink", () => {
  for (const status of appointmentStatuses) {
    const transitions = appointmentTransitions[status];
    assert.ok(Array.isArray(transitions), `missing transition row for ${status}`);
  }
  // Terminal statuses consume no slot and allow no outgoing transition.
  assert.deepEqual(appointmentTransitions.COMPLETED, []);
  assert.deepEqual(appointmentTransitions.CANCELLED, []);
  assert.deepEqual(appointmentTransitions.NO_SHOW, []);
  assert.equal((appointmentSlotConsumingStatuses as readonly string[]).includes("SCHEDULED"), true);
  assert.equal((appointmentSlotConsumingStatuses as readonly string[]).includes("CONFIRMED"), true);
  assert.equal((appointmentSlotConsumingStatuses as readonly string[]).includes("COMPLETED"), false);
  assert.equal((appointmentSlotConsumingStatuses as readonly string[]).includes("CANCELLED"), false);
  assert.equal((appointmentSlotConsumingStatuses as readonly string[]).includes("NO_SHOW"), false);
});

test("appointment transitions are restricted to the declared map", () => {
  assert.equal(canTransitionAppointment("SCHEDULED", "CONFIRMED"), true);
  assert.equal(canTransitionAppointment("SCHEDULED", "COMPLETED"), true);
  assert.equal(canTransitionAppointment("SCHEDULED", "CANCELLED"), true);
  assert.equal(canTransitionAppointment("SCHEDULED", "NO_SHOW"), true);
  assert.equal(canTransitionAppointment("CONFIRMED", "COMPLETED"), true);
  assert.equal(canTransitionAppointment("CONFIRMED", "CANCELLED"), true);
  assert.equal(canTransitionAppointment("CONFIRMED", "NO_SHOW"), true);
  // No backwards, no skip-through, no resurrection from terminal states.
  assert.equal(canTransitionAppointment("CONFIRMED", "SCHEDULED"), false);
  assert.equal(canTransitionAppointment("COMPLETED", "CANCELLED"), false);
  assert.equal(canTransitionAppointment("CANCELLED", "SCHEDULED"), false);
  assert.equal(canTransitionAppointment("NO_SHOW", "CONFIRMED"), false);
});

test("admission decisions: PENDING is the only non-final decision", () => {
  assert.deepEqual(admissionFinalDecisions, ["ACCEPTED", "REJECTED"]);
  assert.ok(!admissionFinalDecisions.includes("PENDING"));
});

test("role gates: STAFF manages appointments and assessments, only MANAGER+ finalizes admissions", () => {
  assert.equal(canManageAppointments("VIEWER"), false);
  assert.equal(canManageAppointments("STAFF"), true);
  assert.equal(canManageAppointments("MANAGER"), true);
  assert.equal(canManageAppointments("OWNER"), true);

  assert.equal(canManageAssessments("VIEWER"), false);
  assert.equal(canManageAssessments("STAFF"), true);
  assert.equal(canManageAssessments("MANAGER"), true);
  assert.equal(canManageAssessments("OWNER"), true);

  assert.equal(canFinalizeAdmission("VIEWER"), false);
  assert.equal(canFinalizeAdmission("STAFF"), false);
  assert.equal(canFinalizeAdmission("MANAGER"), true);
  assert.equal(canFinalizeAdmission("OWNER"), true);
});

test("Phase 4 contact activity types are a bounded, explicit allowlist", () => {
  assert.ok(admissionContactActivityTypes.includes("APPOINTMENT_CREATED"));
  assert.ok(admissionContactActivityTypes.includes("APPOINTMENT_RESCHEDULED"));
  assert.ok(admissionContactActivityTypes.includes("APPOINTMENT_CANCELLED"));
  assert.ok(admissionContactActivityTypes.includes("APPOINTMENT_COMPLETED"));
  assert.ok(admissionContactActivityTypes.includes("ASSESSMENT_CREATED"));
  assert.ok(admissionContactActivityTypes.includes("ASSESSMENT_COMPLETED"));
  assert.ok(admissionContactActivityTypes.includes("ADMISSION_ACCEPTED"));
  assert.ok(admissionContactActivityTypes.includes("ADMISSION_REJECTED"));
});