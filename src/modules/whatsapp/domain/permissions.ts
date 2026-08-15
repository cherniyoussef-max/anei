// Phase 5 authorization vocabulary: WhatsApp message statuses, directions,
// template approval states, and the organization-role gates that govern the
// WhatsApp communication channel. Follows the same shape as the Phase 3/4
// CRM/admission modules: this module names which organization roles may
// perform which WhatsApp operation, reusing the Phase 2 role hierarchy
// instead of inventing a parallel one. The HTTP surface stays admin-only
// (like Phase 3/4); these gates keep the domain service layer
// organization-ready and default-deny.
// See docs/premium/ROADMAP.md Phase 5.
//
// WhatsApp is a communication channel, never the CRM contact itself, never
// an ANEI account, never authentication/authorization/admission/enrollment.
// A CRM contact may receive/send WhatsApp communication without any linked
// ANEI user (linkedUserId is never required here).

import { organizationRoleAtLeast, type OrganizationRole } from "@/modules/relationships/domain/permissions";

// --- Message direction / type ----------------------------------------------------------

export const whatsappDirections = ["INBOUND", "OUTBOUND"] as const;
export type WhatsAppDirection = (typeof whatsappDirections)[number];

export const whatsappMessageTypes = ["TEMPLATE", "TEXT"] as const;
export type WhatsAppMessageType = (typeof whatsappMessageTypes)[number];

// --- Message status state machine ------------------------------------------------------
//
// Aligned with Meta Cloud API semantics: the synchronous 200 + message id means
// Meta accepted the message (SENT), and `sent`/`delivered`/`read`/`failed`
// arrive as asynchronous status webhooks. `QUEUED` is purely local (row persisted,
// provider call in flight). `FAILED` is terminal — Meta reports it once and an
// out-of-order/replayed older callback must never resurrect a failed message.
export const whatsappMessageStatuses = ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"] as const;
export type WhatsAppMessageStatus = (typeof whatsappMessageStatuses)[number];

const statusRank: Record<WhatsAppMessageStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
};

/**
 * Monotonic status precedence. A status callback may only move the local
 * message forward (QUEUED → SENT → DELIVERED → READ) or into the terminal
 * FAILED state. Anything else (e.g. a replayed `sent` arriving after `read`,
 * or any callback after `failed`) is rejected — old/out-of-order webhook
 * events can never regress the local state.
 */
export function canApplyMessageStatus(current: WhatsAppMessageStatus, incoming: WhatsAppMessageStatus): boolean {
  if (current === incoming) return false;
  if (incoming === "FAILED") return current === "QUEUED" || current === "SENT";
  if (current === "FAILED") return false;
  return statusRank[incoming] > statusRank[current];
}

// --- Template approval state -----------------------------------------------------------

export const whatsappTemplateStatuses = ["PENDING", "APPROVED", "REJECTED", "PAUSED", "DISABLED"] as const;
export type WhatsAppTemplateStatus = (typeof whatsappTemplateStatuses)[number];

// --- WhatsApp CRM activity types (bounded, DB CHECK-enforced) --------------------------

export const whatsappContactActivityTypes = [
  "WHATSAPP_TEMPLATE_SENT",
  "WHATSAPP_MESSAGE_RECEIVED",
  "WHATSAPP_FAILED",
] as const;
export type WhatsAppContactActivityType = (typeof whatsappContactActivityTypes)[number];

// --- Organization-role gates (default deny; UI visibility is never authorization) -----

/**
 * VIEWER: read-only message history. STAFF and above: operational sends
 * (template messages to CRM contacts). Sends are communication actions on
 * tracked leads, mirroring the Phase 3/4 rule that STAFF performs operational
 * CRM work while MANAGER/OWNER configure.
 */
export function canManageWhatsappMessages(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "STAFF");
}

/** MANAGER and above: configure the WhatsApp account and sync templates. */
export function canManageWhatsappConfig(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "MANAGER");
}