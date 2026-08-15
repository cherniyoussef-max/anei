// Phase 3 CRM authorization vocabulary. CRM capability is derived from the
// same organization role hierarchy Phase 2 introduced
// (src/modules/relationships/domain/permissions.ts) — this module does not
// invent a parallel role system, it only names which organization roles may
// perform which CRM operation. See docs/premium/ROADMAP.md Phase 3 §L.

import { organizationRoleAtLeast, type OrganizationRole } from "@/modules/relationships/domain/permissions";

export const crmContactStatuses = ["ACTIVE", "ARCHIVED"] as const;
export type CrmContactStatus = (typeof crmContactStatuses)[number];

export const crmContactActivityTypes = [
  "CONTACT_CREATED",
  "CONTACT_UPDATED",
  "CONTACT_ARCHIVED",
  "CONTACT_RESTORED",
  "USER_LINKED",
  "USER_UNLINKED",
  "ASSIGNEE_CHANGED",
  "TAG_ATTACHED",
  "TAG_DETACHED",
  "NOTE_ADDED",
  "STAGE_CHANGED",
  // Phase 4: admission funnel activity (appointments, assessments, decisions).
  "APPOINTMENT_CREATED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_COMPLETED",
  "ASSESSMENT_CREATED",
  "ASSESSMENT_COMPLETED",
  "ADMISSION_ACCEPTED",
  "ADMISSION_REJECTED",
] as const;
export type CrmContactActivityType = (typeof crmContactActivityTypes)[number];

/** VIEWER: read-only. STAFF and above: operational contact/note/tag/stage mutations. */
export function canManageCrmContacts(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "STAFF");
}

/** MANAGER and above: pipeline/stage configuration (creating pipelines, stages). */
export function canManageCrmPipelines(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "MANAGER");
}
