import "server-only";
import { and, asc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { appointment, appointmentAvailabilityRule, appointmentEvent, auditLogs, crmContact, crmContactActivity, organizationMembership, user } from "@/server/db/schema";
import { appointmentSlotConsumingStatuses } from "@/modules/admission/domain/permissions";

const TIMEZONE = "Africa/Tunis";
const MAX_WINDOW_DAYS = 42;
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function tunisParts(date: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(p.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function localToUtc(year: number, month: number, day: number, minuteOfDay: number) {
  const hour = Math.floor(minuteOfDay / 60); const minute = minuteOfDay % 60;
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const probe = new Date(desired);
  const actual = tunisParts(probe);
  const renderedAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
  return new Date(desired - (renderedAsUtc - desired));
}

function utcDayIndex(date: Date) { return Math.floor(date.getTime() / 86_400_000); }

async function lockSlot(tx: DbClient, assigneeUserId: string, startAt: Date, endAt: Date) {
  for (let day = utcDayIndex(startAt); day <= utcDayIndex(endAt); day += 1) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${assigneeUserId}:${day}`}))`);
}

async function conflicts(tx: DbClient, organizationId: string, assigneeUserId: string, startAt: Date, endAt: Date, excludeId?: string) {
  const [row] = await tx.select({ id: appointment.id }).from(appointment).where(and(eq(appointment.organizationId, organizationId), eq(appointment.assignedToUserId, assigneeUserId), inArray(appointment.status, appointmentSlotConsumingStatuses), lt(appointment.startAt, endAt), gt(appointment.endAt, startAt), excludeId ? ne(appointment.id, excludeId) : undefined)).limit(1);
  return Boolean(row);
}

async function ownedContact(tx: DbClient, userId: string, organizationId?: string) {
  const [row] = await tx.select({ id: crmContact.id, organizationId: crmContact.organizationId }).from(crmContact).where(and(eq(crmContact.linkedUserId, userId), eq(crmContact.status, "ACTIVE"), organizationId ? eq(crmContact.organizationId, organizationId) : undefined)).limit(1);
  return row;
}

export type LearnerSlot = { ruleId: string; startAt: string; endAt: string; providerName: string; type: string; durationMinutes: number; timezone: typeof TIMEZONE };

export async function getLearnerAvailability(userId: string, from: Date, to: Date): Promise<LearnerSlot[]> {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86_400_000) return [];
  const contact = await ownedContact(db, userId);
  if (!contact) return [];
  const rules = await db.select({ rule: appointmentAvailabilityRule, providerName: user.name }).from(appointmentAvailabilityRule).innerJoin(user, eq(appointmentAvailabilityRule.assignedToUserId, user.id)).innerJoin(organizationMembership, and(eq(organizationMembership.organizationId, appointmentAvailabilityRule.organizationId), eq(organizationMembership.userId, appointmentAvailabilityRule.assignedToUserId), eq(organizationMembership.status, "ACTIVE"))).where(and(eq(appointmentAvailabilityRule.organizationId, contact.organizationId), eq(appointmentAvailabilityRule.active, true))).orderBy(asc(appointmentAvailabilityRule.weekday), asc(appointmentAvailabilityRule.startMinute));
  if (!rules.length) return [];
  const occupied = await db.select({ assignedToUserId: appointment.assignedToUserId, startAt: appointment.startAt, endAt: appointment.endAt }).from(appointment).where(and(eq(appointment.organizationId, contact.organizationId), inArray(appointment.status, appointmentSlotConsumingStatuses), lt(appointment.startAt, to), gt(appointment.endAt, from)));
  const slots: LearnerSlot[] = [];
  const cursor = new Date(Date.UTC(tunisParts(from).year, tunisParts(from).month - 1, tunisParts(from).day));
  for (let i = 0; i <= MAX_WINDOW_DAYS && cursor < to; i += 1, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth() + 1, day = cursor.getUTCDate(), weekday = cursor.getUTCDay();
    for (const { rule, providerName } of rules.filter((row) => row.rule.weekday === weekday)) {
      for (let minute = rule.startMinute; minute + rule.durationMinutes <= rule.endMinute; minute += rule.durationMinutes) {
        const startAt = localToUtc(year, month, day, minute); const endAt = new Date(startAt.getTime() + rule.durationMinutes * 60_000);
        if (startAt <= new Date() || startAt < from || startAt >= to) continue;
        if (occupied.some((row) => row.assignedToUserId === rule.assignedToUserId && row.startAt < endAt && row.endAt > startAt)) continue;
        slots.push({ ruleId: rule.id, startAt: startAt.toISOString(), endAt: endAt.toISOString(), providerName, type: rule.type, durationMinutes: rule.durationMinutes, timezone: TIMEZONE });
      }
    }
  }
  return slots.slice(0, 200);
}

function matchesRule(rule: typeof appointmentAvailabilityRule.$inferSelect, startAt: Date) {
  const part = tunisParts(startAt); const minute = part.hour * 60 + part.minute;
  return new Date().getTime() < startAt.getTime() && new Date(Date.UTC(part.year, part.month - 1, part.day)).getUTCDay() === rule.weekday && minute >= rule.startMinute && minute + rule.durationMinutes <= rule.endMinute && (minute - rule.startMinute) % rule.durationMinutes === 0;
}

export async function bookLearnerAppointment(userId: string, ruleId: string, startAt: Date) {
  return db.transaction(async (tx) => {
    const [rule] = await tx.select().from(appointmentAvailabilityRule).where(and(eq(appointmentAvailabilityRule.id, ruleId), eq(appointmentAvailabilityRule.active, true))).limit(1);
    if (!rule || !matchesRule(rule, startAt)) return { kind: "unavailable" as const };
    const contact = await ownedContact(tx, userId, rule.organizationId); if (!contact) return { kind: "forbidden" as const };
    const [member] = await tx.select({ id: organizationMembership.id }).from(organizationMembership).where(and(eq(organizationMembership.organizationId, rule.organizationId), eq(organizationMembership.userId, rule.assignedToUserId), eq(organizationMembership.status, "ACTIVE"))).limit(1);
    if (!member) return { kind: "unavailable" as const };
    const endAt = new Date(startAt.getTime() + rule.durationMinutes * 60_000);
    await lockSlot(tx, rule.assignedToUserId, startAt, endAt);
    if (await conflicts(tx, rule.organizationId, rule.assignedToUserId, startAt, endAt)) return { kind: "slot_conflict" as const };
    const [row] = await tx.insert(appointment).values({ organizationId: rule.organizationId, contactId: contact.id, assignedToUserId: rule.assignedToUserId, createdByUserId: userId, type: rule.type, startAt, endAt, status: "SCHEDULED" }).returning({ id: appointment.id });
    await tx.insert(appointmentEvent).values({ appointmentId: row.id, actorUserId: userId, eventType: "CREATED", newStatus: "SCHEDULED", newStartAt: startAt, newEndAt: endAt });
    await tx.insert(crmContactActivity).values({ contactId: contact.id, actorUserId: userId, type: "APPOINTMENT_CREATED", metadata: { appointmentId: row.id, source: "learner_workspace" } });
    await tx.insert(auditLogs).values({ actorUserId: userId, action: "learner.appointment.create", entityType: "appointment", entityId: row.id, metadata: { organizationId: rule.organizationId } });
    return { kind: "ok" as const, id: row.id };
  });
}

export async function cancelLearnerAppointment(userId: string, appointmentId: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ appointment, linkedUserId: crmContact.linkedUserId }).from(appointment).innerJoin(crmContact, and(eq(appointment.contactId, crmContact.id), eq(appointment.organizationId, crmContact.organizationId))).where(and(eq(appointment.id, appointmentId), eq(crmContact.linkedUserId, userId))).limit(1);
    if (!row) return { kind: "not_found" as const };
    if (!["SCHEDULED", "CONFIRMED"].includes(row.appointment.status) || row.appointment.startAt <= new Date()) return { kind: "invalid_transition" as const };
    await tx.update(appointment).set({ status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(appointment.id, appointmentId));
    await tx.insert(appointmentEvent).values({ appointmentId, actorUserId: userId, eventType: "CANCELLED", previousStatus: row.appointment.status, newStatus: "CANCELLED" });
    await tx.insert(crmContactActivity).values({ contactId: row.appointment.contactId, actorUserId: userId, type: "APPOINTMENT_CANCELLED", metadata: { appointmentId, source: "learner_workspace" } });
    return { kind: "ok" as const };
  });
}

export async function rescheduleLearnerAppointment(userId: string, appointmentId: string, ruleId: string, startAt: Date) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ appointment }).from(appointment).innerJoin(crmContact, and(eq(appointment.contactId, crmContact.id), eq(appointment.organizationId, crmContact.organizationId))).where(and(eq(appointment.id, appointmentId), eq(crmContact.linkedUserId, userId))).limit(1);
    if (!existing) return { kind: "not_found" as const };
    if (!["SCHEDULED", "CONFIRMED"].includes(existing.appointment.status) || existing.appointment.startAt <= new Date()) return { kind: "invalid_transition" as const };
    const [rule] = await tx.select().from(appointmentAvailabilityRule).where(and(eq(appointmentAvailabilityRule.id, ruleId), eq(appointmentAvailabilityRule.organizationId, existing.appointment.organizationId), eq(appointmentAvailabilityRule.assignedToUserId, existing.appointment.assignedToUserId), eq(appointmentAvailabilityRule.active, true))).limit(1);
    if (!rule || !matchesRule(rule, startAt)) return { kind: "unavailable" as const };
    const endAt = new Date(startAt.getTime() + rule.durationMinutes * 60_000);
    await lockSlot(tx, rule.assignedToUserId, startAt, endAt);
    if (await conflicts(tx, rule.organizationId, rule.assignedToUserId, startAt, endAt, appointmentId)) return { kind: "slot_conflict" as const };
    await tx.update(appointment).set({ startAt, endAt, updatedAt: new Date() }).where(eq(appointment.id, appointmentId));
    await tx.insert(appointmentEvent).values({ appointmentId, actorUserId: userId, eventType: "RESCHEDULED", previousStartAt: existing.appointment.startAt, previousEndAt: existing.appointment.endAt, newStartAt: startAt, newEndAt: endAt });
    await tx.insert(crmContactActivity).values({ contactId: existing.appointment.contactId, actorUserId: userId, type: "APPOINTMENT_RESCHEDULED", metadata: { appointmentId, source: "learner_workspace" } });
    await tx.insert(auditLogs).values({ actorUserId: userId, action: "learner.appointment.reschedule", entityType: "appointment", entityId: appointmentId, metadata: { organizationId: rule.organizationId } });
    return { kind: "ok" as const };
  });
}

export { TIMEZONE, MAX_WINDOW_DAYS };
