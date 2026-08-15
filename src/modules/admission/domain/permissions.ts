// Phase 4 authorization vocabulary: appointment state machine, assessment and
// admission lifecycles, and the organization-role gates that govern them.
// Follows the same shape as the Phase 3 CRM module
// (src/modules/crm/domain/permissions.ts): this module names which
// organization roles may perform which admission operation, reusing the
// Phase 2 role hierarchy instead of inventing a parallel one. The HTTP
// surface stays admin-only (like Phase 3); these gates keep the domain
// service layer organization-ready and default-deny.
// See docs/premium/ROADMAP.md Phase 4.

import { organizationRoleAtLeast, type OrganizationRole } from "@/modules/relationships/domain/permissions";

// --- Appointment status state machine -------------------------------------------------

export const appointmentStatuses = ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

/** Valid transitions, defined once server-side. Terminal states are not keys. */
export const appointmentTransitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return appointmentTransitions[from]?.includes(to) ?? false;
}

/** Only these statuses consume the staff member's time slot for double-booking purposes. */
export const appointmentSlotConsumingStatuses = ["SCHEDULED", "CONFIRMED"] as const;
export type AppointmentSlotConsumingStatus = (typeof appointmentSlotConsumingStatuses)[number];

export const appointmentTypes = ["ASSESSMENT", "INFO_MEETING", "FOLLOW_UP", "OTHER"] as const;
export type AppointmentType = (typeof appointmentTypes)[number];

// --- Assessment lifecycle -------------------------------------------------------------

export const assessmentStatuses = ["DRAFT", "COMPLETED"] as const;
export type AssessmentStatus = (typeof assessmentStatuses)[number];

// --- Admission lifecycle --------------------------------------------------------------

export const admissionDecisions = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export type AdmissionDecision = (typeof admissionDecisions)[number];

export const admissionFinalDecisions: readonly AdmissionDecision[] = ["ACCEPTED", "REJECTED"];

// --- CRM contact activity types introduced by Phase 4 (bounded, DB CHECK-enforced) ----

export const admissionContactActivityTypes = [
  "APPOINTMENT_CREATED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_COMPLETED",
  "ASSESSMENT_CREATED",
  "ASSESSMENT_COMPLETED",
  "ADMISSION_ACCEPTED",
  "ADMISSION_REJECTED",
] as const;
export type AdmissionContactActivityType = (typeof admissionContactActivityTypes)[number];

// --- Organization-role gates (default deny; UI visibility is never authorization) ----

/** VIEWER: read-only. STAFF and above: schedule/manage appointments. */
export function canManageAppointments(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "STAFF");
}

/** STAFF and above may create and complete assessments. */
export function canManageAssessments(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "STAFF");
}

/** MANAGER and above: finalize admission decisions (ACCEPTED/REJECTED). */
export function canFinalizeAdmission(role: OrganizationRole): boolean {
  return organizationRoleAtLeast(role, "MANAGER");
}