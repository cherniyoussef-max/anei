import { and, count, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import {
  admission,
  appointment,
  appointmentEvent,
  assessment,
  crmContact,
  organizationMembership,
  user,
  type AdmissionRow,
  type AppointmentRow,
  type AssessmentRow,
} from "@/server/db/schema";
import { getOwnOrganizationMembership } from "@/server/queries/organizations";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";

function admissionPageBounds(page?: number, pageSize?: number) {
  const safePage = Number.isSafeInteger(page) && (page ?? 0) > 0 ? page! : 1;
  const safeSize = Math.min(100, Math.max(10, pageSize ?? 25));
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}

const appointmentSortColumns = { createdAt: appointment.createdAt, startAt: appointment.startAt, updatedAt: appointment.updatedAt } as const;
type AppointmentSort = keyof typeof appointmentSortColumns;

export type AppointmentSearchInput = {
  organizationId: string;
  q?: string;
  status?: string;
  contactId?: string;
  assignedToUserId?: string;
  from?: string;
  to?: string;
  sort?: string;
  direction?: string;
  page?: number;
  pageSize?: number;
};

export type AppointmentListItem = AppointmentRow & {
  contactFirstName: string | null;
  contactLastName: string | null;
  assigneeName: string | null;
};

/**
 * `organizationId` is always required and is never authorization by itself —
 * callers must have already verified the caller may act within it (same
 * contract as `searchCrmContacts`). Sort fields are server-allowlisted.
 */
export async function searchAppointments(input: AppointmentSearchInput) {
  const { page, pageSize, offset } = admissionPageBounds(input.page, input.pageSize);
  const filters: SQL[] = [eq(appointment.organizationId, input.organizationId)];

  const q = input.q?.trim().slice(0, 100);
  if (q) {
    const contactRows = await db
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(
        or(ilike(crmContact.firstName, `%${q}%`), ilike(crmContact.lastName, `%${q}%`), ilike(crmContact.email, `%${q}%`))!,
      );
    filters.push(
      inArray(
        appointment.contactId,
        contactRows.map((r) => r.id),
      ),
    );
  }
  if (input.status) filters.push(eq(appointment.status, input.status));
  if (input.contactId) filters.push(eq(appointment.contactId, input.contactId));
  if (input.assignedToUserId) filters.push(eq(appointment.assignedToUserId, input.assignedToUserId));
  if (input.from) filters.push(gte(appointment.startAt, new Date(input.from)));
  if (input.to) filters.push(lte(appointment.endAt, new Date(input.to)));

  const where = and(...filters)!;
  const sortKey: AppointmentSort = input.sort && input.sort in appointmentSortColumns ? (input.sort as AppointmentSort) : "startAt";
  const orderBy = input.direction === "asc" ? appointmentSortColumns[sortKey] : desc(appointmentSortColumns[sortKey]);

  const [countRows, rows] = await Promise.all([
    db.select({ value: count() }).from(appointment).where(where),
    db.select().from(appointment).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;

  const [contacts, assignees] = await Promise.all([
    db
      .select({ id: crmContact.id, firstName: crmContact.firstName, lastName: crmContact.lastName })
      .from(crmContact)
      .where(inArray(crmContact.id, rows.map((r) => r.contactId))),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, rows.map((r) => r.assignedToUserId))),
  ]);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const assigneeMap = new Map(assignees.map((u) => [u.id, u.name]));

  const items: AppointmentListItem[] = rows.map((row) => ({
    ...row,
    contactFirstName: contactMap.get(row.contactId)?.firstName ?? null,
    contactLastName: contactMap.get(row.contactId)?.lastName ?? null,
    assigneeName: assigneeMap.get(row.assignedToUserId) ?? null,
  }));
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAppointment(organizationId: string, appointmentId: string) {
  const [row] = await db
    .select()
    .from(appointment)
    .where(and(eq(appointment.id, appointmentId), eq(appointment.organizationId, organizationId)))
    .limit(1);
  if (!row) return undefined;
  const [contact, assignee, events] = await Promise.all([
    db
      .select({ id: crmContact.id, firstName: crmContact.firstName, lastName: crmContact.lastName, email: crmContact.email, phone: crmContact.phone })
      .from(crmContact)
      .where(eq(crmContact.id, row.contactId))
      .limit(1),
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, row.assignedToUserId))
      .limit(1),
    db
      .select()
      .from(appointmentEvent)
      .where(eq(appointmentEvent.appointmentId, appointmentId))
      .orderBy(appointmentEvent.createdAt),
  ]);
  return {
    appointment: row,
    contact: contact[0] ?? null,
    assignee: assignee[0] ?? null,
    events,
  };
}

export async function getAppointmentEvents(appointmentId: string) {
  return db
    .select()
    .from(appointmentEvent)
    .where(eq(appointmentEvent.appointmentId, appointmentId))
    .orderBy(appointmentEvent.createdAt);
}

// --- Assessments ----------------------------------------------------------------------

const assessmentSortColumns = { createdAt: assessment.createdAt, updatedAt: assessment.updatedAt } as const;
type AssessmentSort = keyof typeof assessmentSortColumns;

export type AssessmentSearchInput = {
  organizationId: string;
  status?: string;
  contactId?: string;
  assessorUserId?: string;
  sort?: string;
  direction?: string;
  page?: number;
  pageSize?: number;
};

export type AssessmentListItem = AssessmentRow & { contactFirstName: string | null; contactLastName: string | null; assessorName: string | null };

export async function searchAssessments(input: AssessmentSearchInput) {
  const { page, pageSize, offset } = admissionPageBounds(input.page, input.pageSize);
  const filters: SQL[] = [eq(assessment.organizationId, input.organizationId)];
  if (input.status === "DRAFT" || input.status === "COMPLETED") filters.push(eq(assessment.status, input.status));
  if (input.contactId) filters.push(eq(assessment.contactId, input.contactId));
  if (input.assessorUserId) filters.push(eq(assessment.assessorUserId, input.assessorUserId));

  const where = and(...filters)!;
  const sortKey: AssessmentSort = input.sort && input.sort in assessmentSortColumns ? (input.sort as AssessmentSort) : "createdAt";
  const orderBy = input.direction === "asc" ? assessmentSortColumns[sortKey] : desc(assessmentSortColumns[sortKey]);

  const [countRows, rows] = await Promise.all([
    db.select({ value: count() }).from(assessment).where(where),
    db.select().from(assessment).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;

  const [contacts, assessors] = await Promise.all([
    db
      .select({ id: crmContact.id, firstName: crmContact.firstName, lastName: crmContact.lastName })
      .from(crmContact)
      .where(inArray(crmContact.id, rows.map((r) => r.contactId))),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, rows.map((r) => r.assessorUserId))),
  ]);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const assessorMap = new Map(assessors.map((u) => [u.id, u.name]));

  const items: AssessmentListItem[] = rows.map((row) => ({
    ...row,
    contactFirstName: contactMap.get(row.contactId)?.firstName ?? null,
    contactLastName: contactMap.get(row.contactId)?.lastName ?? null,
    assessorName: assessorMap.get(row.assessorUserId) ?? null,
  }));
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAssessment(organizationId: string, assessmentId: string) {
  const [row] = await db
    .select()
    .from(assessment)
    .where(and(eq(assessment.id, assessmentId), eq(assessment.organizationId, organizationId)))
    .limit(1);
  if (!row) return undefined;
  const [contact, assessor] = await Promise.all([
    db
      .select({ id: crmContact.id, firstName: crmContact.firstName, lastName: crmContact.lastName })
      .from(crmContact)
      .where(eq(crmContact.id, row.contactId))
      .limit(1),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, row.assessorUserId))
      .limit(1),
  ]);
  return { assessment: row, contact: contact[0] ?? null, assessor: assessor[0] ?? null };
}

// --- Admissions -----------------------------------------------------------------------

const admissionSortColumns = { createdAt: admission.createdAt, decidedAt: admission.decidedAt } as const;
type AdmissionSort = keyof typeof admissionSortColumns;

export type AdmissionSearchInput = {
  organizationId: string;
  decision?: string;
  contactId?: string;
  sort?: string;
  direction?: string;
  page?: number;
  pageSize?: number;
};

export type AdmissionListItem = AdmissionRow & { contactFirstName: string | null; contactLastName: string | null; decidedByName: string | null };

export async function searchAdmissions(input: AdmissionSearchInput) {
  const { page, pageSize, offset } = admissionPageBounds(input.page, input.pageSize);
  const filters: SQL[] = [eq(admission.organizationId, input.organizationId)];
  if (input.decision) filters.push(eq(admission.decision, input.decision));
  if (input.contactId) filters.push(eq(admission.contactId, input.contactId));

  const where = and(...filters)!;
  const sortKey: AdmissionSort = input.sort && input.sort in admissionSortColumns ? (input.sort as AdmissionSort) : "createdAt";
  const orderBy = input.direction === "asc" ? admissionSortColumns[sortKey] : desc(admissionSortColumns[sortKey]);

  const [countRows, rows] = await Promise.all([
    db.select({ value: count() }).from(admission).where(where),
    db.select().from(admission).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;

  const [contacts, deciders] = await Promise.all([
    db
      .select({ id: crmContact.id, firstName: crmContact.firstName, lastName: crmContact.lastName })
      .from(crmContact)
      .where(inArray(crmContact.id, rows.map((r) => r.contactId))),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(
        inArray(
          user.id,
          rows.map((r) => r.decidedByUserId).filter((id): id is string => Boolean(id)),
        ),
      ),
  ]);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const deciderMap = new Map(deciders.map((u) => [u.id, u.name]));

  const items: AdmissionListItem[] = rows.map((row) => ({
    ...row,
    contactFirstName: contactMap.get(row.contactId)?.firstName ?? null,
    contactLastName: contactMap.get(row.contactId)?.lastName ?? null,
    decidedByName: row.decidedByUserId ? (deciderMap.get(row.decidedByUserId) ?? null) : null,
  }));
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdmission(organizationId: string, admissionId: string) {
  const [row] = await db
    .select()
    .from(admission)
    .where(and(eq(admission.id, admissionId), eq(admission.organizationId, organizationId)))
    .limit(1);
  if (!row) return undefined;
  const [contact, decider] = await Promise.all([
    db
      .select({ id: crmContact.id, firstName: crmContact.firstName, lastName: crmContact.lastName })
      .from(crmContact)
      .where(eq(crmContact.id, row.contactId))
      .limit(1),
    row.decidedByUserId
      ? db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(eq(user.id, row.decidedByUserId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  return { admission: row, contact: contact[0] ?? null, decider: decider[0] ?? null };
}

export async function getAdmissionForContact(organizationId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(admission)
    .where(and(eq(admission.organizationId, organizationId), eq(admission.contactId, contactId)))
    .orderBy(desc(admission.createdAt))
    .limit(1);
  return row;
}

export async function getAssessmentsForContact(organizationId: string, contactId: string) {
  return db
    .select()
    .from(assessment)
    .where(and(eq(assessment.organizationId, organizationId), eq(assessment.contactId, contactId)))
    .orderBy(desc(assessment.createdAt));
}

export async function getAppointmentsForContact(organizationId: string, contactId: string) {
  return db
    .select()
    .from(appointment)
    .where(and(eq(appointment.organizationId, organizationId), eq(appointment.contactId, contactId)))
    .orderBy(desc(appointment.startAt));
}

/**
 * Resolves the actor's effective organization role for the Phase 4 services.
 * A platform admin (the HTTP surface is admin-only) who holds an ACTIVE
 * membership uses their membership role; a platform admin without a
 * membership is treated as MANAGER so the admin console can operate any
 * organization. The services enforce the organization-role gates on top of
 * this resolved role (default deny).
 */
export async function resolveActorOrgRole(userId: string, organizationId: string): Promise<OrganizationRole> {
  const membership = await getOwnOrganizationMembership(userId, organizationId);
  return membership ? (membership.role as OrganizationRole) : "MANAGER";
}

export async function getOrgMembersForAssignment(organizationId: string) {
  return db
    .select({ userId: organizationMembership.userId, name: user.name })
    .from(organizationMembership)
    .innerJoin(user, eq(user.id, organizationMembership.userId))
    .where(and(eq(organizationMembership.organizationId, organizationId), eq(organizationMembership.status, "ACTIVE")))
    .orderBy(user.name);
}

export type { AdmissionRow, AppointmentRow, AssessmentRow };