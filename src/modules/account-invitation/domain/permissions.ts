// Phase 6 authorization vocabulary: account invitation lifecycle, phone
// verification challenge state, and the organization-role gate that governs
// invitation creation/resend/revoke. Follows the same shape as the Phase 3/4/5
// CRM/admission/WhatsApp modules: this module names which organization roles
// may perform which invitation operation, reusing the Phase 2 role hierarchy.
// See docs/premium/ROADMAP.md Phase 6.
//
// An invitation is a durable, revocable, one-time-consumable credential --
// never an account, never a session, never authentication by itself. Phone
// verification (OTP) proves control of the invited phone at that moment; it
// never authenticates a Better Auth user and never selects an existing
// account by phone. Account provisioning/login remain entirely Better
// Auth-owned.

import { organizationRoleAtLeast, type OrganizationRole } from "@/modules/relationships/domain/permissions";

// --- Invitation status state machine ----------------------------------------------------

export const accountInvitationStatuses = [
  "PENDING_SEND",
  "SENT",
  "SEND_FAILED",
  "VERIFIED",
  "CONSUMED",
  "REVOKED",
  "EXPIRED",
] as const;
export type AccountInvitationStatus = (typeof accountInvitationStatuses)[number];

/** Terminal states never accept further transitions. */
export const accountInvitationTerminalStatuses: readonly AccountInvitationStatus[] = ["CONSUMED", "REVOKED", "EXPIRED"];

/** Statuses in which the invitation is still usable for OTP send/verify. */
export const accountInvitationLiveStatuses: readonly AccountInvitationStatus[] = ["PENDING_SEND", "SENT", "VERIFIED"];

export function isAccountInvitationTerminal(status: AccountInvitationStatus): boolean {
  return accountInvitationTerminalStatuses.includes(status);
}

// --- Invitation-scoped, only-STUDENT persona --------------------------------------------

export const invitablePersonas = ["STUDENT"] as const;
export type InvitablePersona = (typeof invitablePersonas)[number];

// --- Verification challenge status -------------------------------------------------------

export const verificationChallengeStatuses = ["ACTIVE", "VERIFIED", "LOCKED", "SUPERSEDED", "EXPIRED"] as const;
export type VerificationChallengeStatus = (typeof verificationChallengeStatuses)[number];

// --- Invitation event types (bounded, DB CHECK-enforced, append-only) -------------------

export const accountInvitationEventTypes = [
  "INVITATION_CREATED",
  "INVITATION_SENT",
  "INVITATION_RESENT",
  "INVITATION_SEND_FAILED",
  "OTP_SENT",
  "PHONE_VERIFIED",
  "INVITATION_REVOKED",
  "INVITATION_CONSUMED",
] as const;
export type AccountInvitationEventType = (typeof accountInvitationEventTypes)[number];

// --- Organization-role gate (default deny; UI visibility is never authorization) --------

/** MANAGER and above: create/resend/revoke account invitations (mirrors admission finalize / WhatsApp config gates). */
export function canManageInvitations(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "MANAGER");
}

// --- Bounded API error codes (never expose internal DB/provider errors) -----------------

export const invitationErrorCodes = [
  "NOT_ELIGIBLE",
  "ALREADY_LINKED",
  "INVITATION_EXPIRED",
  "INVITATION_REVOKED",
  "INVALID_INVITATION",
  "SEND_COOLDOWN",
  "SEND_LIMIT",
  "INVALID_CODE",
  "CODE_EXPIRED",
  "ATTEMPTS_EXHAUSTED",
  "NOT_VERIFIED",
  "ALREADY_CONSUMED",
  "LINK_CONFLICT",
  "NOT_CONFIGURED",
  "RATE_LIMITED",
  "FORBIDDEN",
  "NOT_FOUND",
] as const;
export type InvitationErrorCode = (typeof invitationErrorCodes)[number];
