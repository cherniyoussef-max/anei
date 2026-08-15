/**
 * Phase 6 invitation domain vocabulary (src/modules/invitation/domain/permissions.ts):
 * statuses, transitions, the STUDENT-only persona lock, bounded event/activity
 * types, and the MANAGER+ organization-role gate. Pure, no imports from
 * server-only modules.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  canManageInvitations,
  invitationEventTypes,
  invitationIntendedPersonas,
  invitationLiveStatuses,
  invitationStatuses,
  invitationTransitions,
  canTransitionInvitation,
  isInvitationLive,
  verificationChallengeStatuses,
} from "../../src/modules/invitation/domain/permissions";
import { crmContactActivityTypes } from "../../src/modules/crm/domain/permissions";

test("invitation statuses are a closed set with terminal CONSUMED/REVOKED/EXPIRED states", () => {
  assert.deepEqual(invitationStatuses, ["PENDING_SEND", "SENT", "VERIFIED", "CONSUMED", "REVOKED", "EXPIRED"]);
  for (const status of invitationStatuses) {
    assert.deepEqual(invitationTransitions[status], status === "PENDING_SEND" ? ["SENT", "REVOKED"] : status === "SENT" ? ["VERIFIED", "REVOKED"] : status === "VERIFIED" ? ["CONSUMED", "REVOKED"] : []);
  }
  assert.equal(canTransitionInvitation("PENDING_SEND", "SENT"), true);
  assert.equal(canTransitionInvitation("SENT", "VERIFIED"), true);
  assert.equal(canTransitionInvitation("VERIFIED", "CONSUMED"), true);
  assert.equal(canTransitionInvitation("CONSUMED", "SENT"), false, "terminal states are not keys");
  assert.equal(canTransitionInvitation("REVOKED", "VERIFIED"), false);
  assert.equal(canTransitionInvitation("EXPIRED", "SENT"), false);
  assert.equal(canTransitionInvitation("PENDING_SEND", "CONSUMED"), false, "no skipping steps");
});

test("live statuses are exactly the usable ones; a contact can hold one live invitation", () => {
  assert.deepEqual(invitationLiveStatuses, ["PENDING_SEND", "SENT", "VERIFIED"]);
  assert.equal(isInvitationLive("SENT"), true);
  assert.equal(isInvitationLive("REVOKED"), false);
  assert.equal(isInvitationLive("CONSUMED"), false);
  assert.equal(isInvitationLive("EXPIRED"), false);
});

test("intendedPersona is locked to STUDENT — an invitation can never grant another role", () => {
  assert.deepEqual(invitationIntendedPersonas, ["STUDENT"]);
});

test("event and challenge types are closed sets (DB CHECK-backed)", () => {
  assert.deepEqual(invitationEventTypes, ["INVITATION_CREATED", "INVITATION_SENT", "INVITATION_SEND_FAILED", "OTP_SENT", "PHONE_VERIFIED", "INVITATION_REVOKED", "INVITATION_CONSUMED", "INVITATION_EXPIRED"]);
  assert.deepEqual(verificationChallengeStatuses, ["ACTIVE", "VERIFIED", "LOCKED", "SUPERSEDED", "EXPIRED"]);
});

test("every Phase 6 activity type is a member of the CRM contact activity allowlist", () => {
  for (const type of ["ACCOUNT_INVITATION_SENT", "PHONE_VERIFIED", "ACCOUNT_LINKED", "ACCOUNT_INVITATION_REVOKED"]) {
    assert.ok(crmContactActivityTypes.includes(type as (typeof crmContactActivityTypes)[number]), `${type} must exist in the CRM allowlist`);
  }
});

test("canManageInvitations is MANAGER+ (STAFF and below are denied)", () => {
  assert.equal(canManageInvitations("OWNER"), true);
  assert.equal(canManageInvitations("MANAGER"), true);
  assert.equal(canManageInvitations("STAFF"), false);
  assert.equal(canManageInvitations("VIEWER"), false);
});