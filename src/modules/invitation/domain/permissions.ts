// Phase 6 authorization vocabulary: account invitation lifecycle, phone
// verification challenge states, invitation event types, and the
// organization-role gates that govern them. Follows the same shape as the
// Phase 3/4/5 modules (src/modules/crm, admission, whatsapp): it names which
// organization roles may perform which invitation operation, reusing the
// Phase 2 role hierarchy instead of inventing a parallel one. The HTTP
// surface stays admin-only for mutations; the invitation bearer token + OTP
// + real Better Auth session are the public-flow credentials.
// See docs/premium/ROADMAP.md Phase 6.
//
// Invitations are account-creation gates, never an authentication mechanism:
// phone verification (PHONE_VERIFIED) only advances the invitation toward
// CLAIM; the claim itself requires a genuine Better Auth session. No
// invitation can grant an admin role — intendedPersona is locked to STUDENT.

import { organizationRoleAtLeast, type OrganizationRole } from "@/modules/relationships/domain/permissions";

// --- Invitation lifecycle -------------------------------------------------------------

export const invitationStatuses = ["PENDING_SEND", "SENT", "VERIFIED", "CONSUMED", "REVOKED", "EXPIRED"] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

/**
 * Statuses in which an invitation is still usable (a live row). A contact may
 * hold at most one live invitation (DB partial unique index).
 */
export const invitationLiveStatuses: readonly InvitationStatus[] = ["PENDING_SEND", "SENT", "VERIFIED"];

export function isInvitationLive(status: InvitationStatus): boolean {
  return invitationLiveStatuses.includes(status);
}

/** Valid transitions, defined once server-side. Terminal states are not keys. */
export const invitationTransitions: Record<InvitationStatus, readonly InvitationStatus[]> = {
  PENDING_SEND: ["SENT", "REVOKED"],
  SENT: ["VERIFIED", "REVOKED"],
  VERIFIED: ["CONSUMED", "REVOKED"],
  CONSUMED: [],
  REVOKED: [],
  EXPIRED: [],
};

export function canTransitionInvitation(from: InvitationStatus, to: InvitationStatus): boolean {
  return invitationTransitions[from]?.includes(to) ?? false;
}

/** The only persona an invitation may grant. Locked at the DB CHECK level too. */
export const invitationIntendedPersonas = ["STUDENT"] as const;
export type InvitationIntendedPersona = (typeof invitationIntendedPersonas)[number];

// --- Verification challenge states -----------------------------------------------------

export const verificationChallengeStatuses = ["ACTIVE", "VERIFIED", "LOCKED", "SUPERSEDED", "EXPIRED"] as const;
export type VerificationChallengeStatus = (typeof verificationChallengeStatuses)[number];

// --- Invitation event types (bounded, DB CHECK-enforced) -------------------------------

export const invitationEventTypes = [
  "INVITATION_CREATED",
  "INVITATION_SENT",
  "INVITATION_SEND_FAILED",
  "OTP_SENT",
  "PHONE_VERIFIED",
  "INVITATION_REVOKED",
  "INVITATION_CONSUMED",
  "INVITATION_EXPIRED",
] as const;
export type InvitationEventType = (typeof invitationEventTypes)[number];

// --- CRM contact activity types introduced by Phase 6 (bounded, DB CHECK-enforced) ----

export const invitationContactActivityTypes = [
  "ACCOUNT_INVITATION_SENT",
  "PHONE_VERIFIED",
  "ACCOUNT_LINKED",
  "ACCOUNT_INVITATION_REVOKED",
] as const;
export type InvitationContactActivityType = (typeof invitationContactActivityTypes)[number];

// --- Organization-role gates (default deny; UI visibility is never authorization) -----

/**
 * MANAGER and above: create/send/resend/revoke account invitations. Invitation
 * creation is an organizational action on a tracked lead (mirrors Phase 4's
 * canFinalizeAdmission boundary) — STAFF performs operational CRM work but the
 * decision to open an account-creation flow stays with managers.
 */
export function canManageInvitations(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "MANAGER");
}