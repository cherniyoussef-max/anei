import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  appointment,
  appointmentEvent,
  auditLogs,
  crmContact,
  crmContactActivity,
  organizationMembership,
  type AppointmentRow,
} from "@/server/db/schema";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";
import {
  appointmentSlotConsumingStatuses,
  canManageAppointments,
  canTransitionAppointment,
  type AppointmentStatus,
  type AppointmentType,
} from "@/modules/admission/domain/permissions";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type AppointmentMutationResult =
  | { kind: "ok"; id: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_contact" }
  | { kind: "invalid_assignee" }
  | { kind: "invalid_time_range" }
  | { kind: "slot_conflict" }
  | { kind: "invalid_transition" };

/** Active organization membership check — the same primitive used by the Phase 3 CRM service. */
async function isActiveOrgMember(tx: DbClient, organizationId: string, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: organizationMembership.id })
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.organizationId, organizationId),
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** UTC calendar day index for a timestamp — used to key the per-day advisory locks. */
function utcDayIndex(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/**
 * Serializes every slot-mutating transaction for a given assignee + day.
 * Two concurrent `Promise.all` booking requests for the same staff member on
 * the same day can therefore never both read "no overlap" and both proceed:
 * the second transaction blocks on the lock until the first commits (or
 * rolls back) and only then runs its authoritative overlap query. The lock
 * is transaction-scoped (`pg_advisory_xact_lock`) so it releases
 * automatically on commit/rollback, mirroring the organization service's
 * ownership lock (src/server/services/organizations.ts).
 */
async function lockAssigneeSlot(tx: DbClient, assigneeUserId: string, startAt: Date, endAt: Date): Promise<void> {
  const firstDay = utcDayIndex(startAt);
  const lastDay = utcDayIndex(endAt);
  for (let day = firstDay; day <= lastDay; day += 1) {
    const key = `${assigneeUserId}:${day}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  }
}

/** Authoritative overlap check — runs INSIDE the advisory-locked transaction, never as a naive SELECT-then-INSERT. */
async function findSlotConflict(
  tx: DbClient,
  organizationId: string,
  assigneeUserId: string,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const [conflict] = await tx
    .select({ id: appointment.id })
    .from(appointment)
    .where(
      and(
        eq(appointment.organizationId, organizationId),
        eq(appointment.assignedToUserId, assigneeUserId),
        inArray(appointment.status, appointmentSlotConsumingStatuses),
        lt(appointment.startAt, endAt),
        gt(appointment.endAt, startAt),
        ...(excludeAppointmentId ? [ne(appointment.id, excludeAppointmentId)] : []),
      ),
    )
    .limit(1);
  return Boolean(conflict);
}

/**
 * Creates an appointment for a CRM contact. The contact is the identity
 * anchor — no ANEI account is required (prospects precede accounts, so
 * `linkedUserId` is never involved here). The assignee must be an ACTIVE
 * member of the same organization, verified from the DB. Slot availability
 * is derived from existing appointments only, enforced under a per-day
 * advisory lock as described in lockAssigneeSlot.
 */
export async function createAppointment(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  data: {
    contactId: string;
    assignedToUserId: string;
    type: AppointmentType;
    startAt: Date;
    endAt: Date;
    note?: string | null;
  },
): Promise<AppointmentMutationResult> {
  if (!canManageAppointments(actorRole)) return { kind: "forbidden" };
  if (data.endAt <= data.startAt) return { kind: "invalid_time_range" };

  return db.transaction(async (tx) => {
    const [contact] = await tx
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(eq(crmContact.id, data.contactId), eq(crmContact.organizationId, organizationId)))
      .limit(1);
    if (!contact) return { kind: "invalid_contact" };

    if (!(await isActiveOrgMember(tx, organizationId, data.assignedToUserId))) {
      return { kind: "invalid_assignee" };
    }

    await lockAssigneeSlot(tx, data.assignedToUserId, data.startAt, data.endAt);
    if (await findSlotConflict(tx, organizationId, data.assignedToUserId, data.startAt, data.endAt)) {
      return { kind: "slot_conflict" };
    }

    const [row] = await tx
      .insert(appointment)
      .values({
        organizationId,
        contactId: data.contactId,
        assignedToUserId: data.assignedToUserId,
        createdByUserId: actorUserId,
        type: data.type,
        startAt: data.startAt,
        endAt: data.endAt,
        status: "SCHEDULED",
        note: data.note ?? null,
      })
      .returning();

    await tx.insert(appointmentEvent).values({
      appointmentId: row.id,
      actorUserId,
      eventType: "CREATED",
      newStatus: "SCHEDULED",
      newStartAt: data.startAt,
      newEndAt: data.endAt,
    });
    await tx.insert(crmContactActivity).values({
      contactId: data.contactId,
      actorUserId,
      type: "APPOINTMENT_CREATED",
      metadata: {
        appointmentId: row.id,
        assignedToUserId: data.assignedToUserId,
        startAt: data.startAt.toISOString(),
        endAt: data.endAt.toISOString(),
      },
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.appointment.create",
      entityType: "appointment",
      entityId: row.id,
      metadata: { organizationId, contactId: data.contactId },
    });
    return { kind: "ok", id: row.id };
  });
}

/** Only SCHEDULED/CONFIRMED appointments may be moved — terminal states are immutable. */
export async function rescheduleAppointment(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  appointmentId: string,
  startAt: Date,
  endAt: Date,
): Promise<AppointmentMutationResult> {
  if (!canManageAppointments(actorRole)) return { kind: "forbidden" };
  if (endAt <= startAt) return { kind: "invalid_time_range" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(appointment)
      .where(and(eq(appointment.id, appointmentId), eq(appointment.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    if (existing.status !== "SCHEDULED" && existing.status !== "CONFIRMED") return { kind: "invalid_transition" };

    await lockAssigneeSlot(tx, existing.assignedToUserId, startAt, endAt);
    if (await findSlotConflict(tx, organizationId, existing.assignedToUserId, startAt, endAt, appointmentId)) {
      return { kind: "slot_conflict" };
    }

    await tx.update(appointment).set({ startAt, endAt, updatedAt: new Date() }).where(eq(appointment.id, appointmentId));
    await tx.insert(appointmentEvent).values({
      appointmentId,
      actorUserId,
      eventType: "RESCHEDULED",
      previousStartAt: existing.startAt,
      previousEndAt: existing.endAt,
      newStartAt: startAt,
      newEndAt: endAt,
    });
    await tx.insert(crmContactActivity).values({
      contactId: existing.contactId,
      actorUserId,
      type: "APPOINTMENT_RESCHEDULED",
      metadata: {
        appointmentId,
        from: existing.startAt.toISOString(),
        to: startAt.toISOString(),
      },
    });
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "crm.appointment.reschedule",
      entityType: "appointment",
      entityId: appointmentId,
      metadata: { organizationId, from: existing.startAt.toISOString(), to: startAt.toISOString() },
    });
    return { kind: "ok", id: appointmentId };
  });
}

/**
 * Single state-transition entry point: CONFIRMED/COMPLETED/CANCELLED/NO_SHOW.
 * The transition map lives in the domain module and is enforced here against
 * the freshly-loaded row — a stale client can never jump states.
 */
export async function setAppointmentStatus(
  actorUserId: string,
  actorRole: OrganizationRole,
  organizationId: string,
  appointmentId: string,
  to: AppointmentStatus,
): Promise<AppointmentMutationResult> {
  if (!canManageAppointments(actorRole)) return { kind: "forbidden" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(appointment)
      .where(and(eq(appointment.id, appointmentId), eq(appointment.organizationId, organizationId)))
      .limit(1);
    if (!existing) return { kind: "not_found" };
    if (!canTransitionAppointment(existing.status as AppointmentStatus, to)) return { kind: "invalid_transition" };

    await tx
      .update(appointment)
      .set({
        status: to,
        updatedAt: new Date(),
        completedAt: to === "COMPLETED" ? new Date() : existing.completedAt,
        cancelledAt: to === "CANCELLED" ? new Date() : existing.cancelledAt,
      })
      .where(eq(appointment.id, appointmentId));

    await tx.insert(appointmentEvent).values({
      appointmentId,
      actorUserId,
      eventType: to,
      previousStatus: existing.status,
      newStatus: to,
    });

    if (to === "CANCELLED" || to === "COMPLETED") {
      await tx.insert(crmContactActivity).values({
        contactId: existing.contactId,
        actorUserId,
        type: to === "CANCELLED" ? "APPOINTMENT_CANCELLED" : "APPOINTMENT_COMPLETED",
        metadata: { appointmentId },
      });
    }
    await tx.insert(auditLogs).values({
      actorUserId,
      action: `crm.appointment.${to.toLowerCase()}`,
      entityType: "appointment",
      entityId: appointmentId,
      metadata: { organizationId, from: existing.status, to },
    });
    return { kind: "ok", id: appointmentId };
  });
}

export type { AppointmentRow, AppointmentMutationResult };