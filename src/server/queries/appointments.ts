import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { appointment, crmContact, user } from "@/server/db/schema";

/**
 * Upcoming appointments where the caller is the assignee - scoped by
 * appointment.assignedToUserId (never a client-supplied id), matching the
 * appointment_assignee_start_idx index. Used by the AVS/Specialist/Teacher
 * dashboards for a bounded "next appointments" widget. Not used for PARENT:
 * parents are never appointment assignees in this model.
 */
export async function getUpcomingAppointmentsForAssignee(assignedToUserId: string, limit = 5) {
  return db
    .select({ appointment, contact: crmContact })
    .from(appointment)
    .innerJoin(crmContact, eq(appointment.contactId, crmContact.id))
    .where(
      and(
        eq(appointment.assignedToUserId, assignedToUserId),
        gte(appointment.startAt, new Date()),
        inArray(appointment.status, ["SCHEDULED", "CONFIRMED"]),
      ),
    )
    .orderBy(asc(appointment.startAt))
    .limit(limit);
}

/**
 * Next upcoming appointment for a single student, scoped through the
 * student's own CRM contact record (crmContact.linkedUserId), never a
 * client-supplied contact id. Callers MUST verify the caller is authorized
 * to view this student first (e.g. hasActiveParentLink) — this function
 * performs no relationship check itself, matching getLinkedStudentsProgressForParent's
 * contract in src/server/queries/relationships.ts.
 */
export async function getNextAppointmentForStudent(studentUserId: string) {
  const [row] = await db
    .select({ appointment, assigneeName: user.name })
    .from(appointment)
    .innerJoin(crmContact, eq(appointment.contactId, crmContact.id))
    .innerJoin(user, eq(appointment.assignedToUserId, user.id))
    .where(
      and(
        eq(crmContact.linkedUserId, studentUserId),
        gte(appointment.startAt, new Date()),
        inArray(appointment.status, ["SCHEDULED", "CONFIRMED"]),
      ),
    )
    .orderBy(asc(appointment.startAt))
    .limit(1);
  return row ?? null;
}
