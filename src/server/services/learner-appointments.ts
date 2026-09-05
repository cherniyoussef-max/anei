import "server-only";
import { createHash } from "node:crypto";
import { and, asc, count, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { appointment, appointmentAvailabilityRule, appointmentEvent, auditLogs, crmContact, crmContactActivity, organizationMembership, user } from "@/server/db/schema";
import { appointmentSlotConsumingStatuses } from "@/modules/admission/domain/permissions";

const TIMEZONE = "Africa/Tunis";
const MAX_WINDOW_DAYS = 42;
const ADMIN_WINDOW_DAYS = 14;
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type AvailabilityRule = typeof appointmentAvailabilityRule.$inferSelect;

function tunisParts(date: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(p.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function dateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

/**
 * Deterministic, presentable Meet-style link derived from the slot identity. This is a generated
 * placeholder (matches the project's existing mock-integration pattern for payments) — it is not
 * created via the Google Calendar/Meet API, so it will not resolve to a real live room.
 */
function generateMeetingLink(seed: string) {
  const hash = createHash("sha256").update(seed).digest("hex");
  const letters = "abcdefghijklmnop";
  const segment = (start: number, length: number) => Array.from({ length }, (_, i) => letters[parseInt(hash[start + i], 16)]).join("");
  return `https://meet.google.com/${segment(0, 3)}-${segment(3, 4)}-${segment(7, 3)}`;
}

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

export type LearnerSlot = {
  ruleId: string; startAt: string; endAt: string; providerName: string; type: string; durationMinutes: number; timezone: typeof TIMEZONE;
  sessionType: "INDIVIDUAL" | "GROUP"; capacity: number; bookedCount: number; remainingCapacity: number;
};

export async function getLearnerAvailability(userId: string, from: Date, to: Date): Promise<LearnerSlot[]> {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86_400_000) return [];
  const contact = await ownedContact(db, userId);
  if (!contact) return [];
  const rules = await db.select({ rule: appointmentAvailabilityRule, providerName: user.name }).from(appointmentAvailabilityRule).innerJoin(user, eq(appointmentAvailabilityRule.assignedToUserId, user.id)).innerJoin(organizationMembership, and(eq(organizationMembership.organizationId, appointmentAvailabilityRule.organizationId), eq(organizationMembership.userId, appointmentAvailabilityRule.assignedToUserId), eq(organizationMembership.status, "ACTIVE"))).where(and(eq(appointmentAvailabilityRule.organizationId, contact.organizationId), eq(appointmentAvailabilityRule.active, true)));
  if (!rules.length) return [];
  const occupied = await db.select({ contactId: appointment.contactId, assignedToUserId: appointment.assignedToUserId, startAt: appointment.startAt, endAt: appointment.endAt }).from(appointment).where(and(eq(appointment.organizationId, contact.organizationId), inArray(appointment.status, appointmentSlotConsumingStatuses), lt(appointment.startAt, to), gt(appointment.endAt, from)));
  const slots: LearnerSlot[] = [];
  const cursor = new Date(Date.UTC(tunisParts(from).year, tunisParts(from).month - 1, tunisParts(from).day));
  for (let i = 0; i <= MAX_WINDOW_DAYS && cursor < to; i += 1, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth() + 1, day = cursor.getUTCDate(), weekday = cursor.getUTCDay();
    const key = dateKey(year, month, day);
    const applicable = rules.filter((row) => row.rule.weekday !== null ? row.rule.weekday === weekday : row.rule.specificDate === key);
    for (const { rule, providerName } of applicable) {
      for (let minute = rule.startMinute; minute + rule.durationMinutes <= rule.endMinute; minute += rule.durationMinutes) {
        const startAt = localToUtc(year, month, day, minute); const endAt = new Date(startAt.getTime() + rule.durationMinutes * 60_000);
        if (startAt <= new Date() || startAt < from || startAt >= to) continue;
        if (rule.sessionType === "GROUP") {
          const matching = occupied.filter((row) => row.assignedToUserId === rule.assignedToUserId && row.startAt.getTime() === startAt.getTime() && row.endAt.getTime() === endAt.getTime());
          if (matching.some((row) => row.contactId === contact.id)) continue;
          if (matching.length >= rule.capacity) continue;
          slots.push({ ruleId: rule.id, startAt: startAt.toISOString(), endAt: endAt.toISOString(), providerName, type: rule.type, durationMinutes: rule.durationMinutes, timezone: TIMEZONE, sessionType: "GROUP", capacity: rule.capacity, bookedCount: matching.length, remainingCapacity: rule.capacity - matching.length });
        } else {
          if (occupied.some((row) => row.assignedToUserId === rule.assignedToUserId && row.startAt < endAt && row.endAt > startAt)) continue;
          slots.push({ ruleId: rule.id, startAt: startAt.toISOString(), endAt: endAt.toISOString(), providerName, type: rule.type, durationMinutes: rule.durationMinutes, timezone: TIMEZONE, sessionType: "INDIVIDUAL", capacity: 1, bookedCount: 0, remainingCapacity: 1 });
        }
      }
    }
  }
  return slots.slice(0, 200);
}

function matchesRule(rule: AvailabilityRule, startAt: Date) {
  const part = tunisParts(startAt); const minute = part.hour * 60 + part.minute;
  if (new Date().getTime() >= startAt.getTime()) return false;
  const dayMatches = rule.weekday !== null
    ? new Date(Date.UTC(part.year, part.month - 1, part.day)).getUTCDay() === rule.weekday
    : rule.specificDate === dateKey(part.year, part.month, part.day);
  return dayMatches && minute >= rule.startMinute && minute + rule.durationMinutes <= rule.endMinute && (minute - rule.startMinute) % rule.durationMinutes === 0;
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
    if (rule.sessionType === "GROUP") {
      const [duplicate] = await tx.select({ id: appointment.id }).from(appointment).where(and(eq(appointment.contactId, contact.id), eq(appointment.assignedToUserId, rule.assignedToUserId), eq(appointment.startAt, startAt), eq(appointment.endAt, endAt), inArray(appointment.status, appointmentSlotConsumingStatuses))).limit(1);
      if (duplicate) return { kind: "already_booked" as const };
      const [{ value: booked }] = await tx.select({ value: count() }).from(appointment).where(and(eq(appointment.organizationId, rule.organizationId), eq(appointment.assignedToUserId, rule.assignedToUserId), eq(appointment.startAt, startAt), eq(appointment.endAt, endAt), inArray(appointment.status, appointmentSlotConsumingStatuses)));
      if (booked >= rule.capacity) return { kind: "slot_conflict" as const };
    } else if (await conflicts(tx, rule.organizationId, rule.assignedToUserId, startAt, endAt)) {
      return { kind: "slot_conflict" as const };
    }
    const meetingUrl = generateMeetingLink(`${rule.id}:${startAt.toISOString()}`);
    const [row] = await tx.insert(appointment).values({ organizationId: rule.organizationId, contactId: contact.id, assignedToUserId: rule.assignedToUserId, createdByUserId: userId, type: rule.type, startAt, endAt, status: "SCHEDULED", meetingUrl }).returning({ id: appointment.id });
    await tx.insert(appointmentEvent).values({ appointmentId: row.id, actorUserId: userId, eventType: "CREATED", newStatus: "SCHEDULED", newStartAt: startAt, newEndAt: endAt });
    await tx.insert(crmContactActivity).values({ contactId: contact.id, actorUserId: userId, type: "APPOINTMENT_CREATED", metadata: { appointmentId: row.id, source: "learner_workspace" } });
    await tx.insert(auditLogs).values({ actorUserId: userId, action: "learner.appointment.create", entityType: "appointment", entityId: row.id, metadata: { organizationId: rule.organizationId } });
    return { kind: "ok" as const, id: row.id, meetingUrl };
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
    if (rule.sessionType !== "GROUP" && await conflicts(tx, rule.organizationId, rule.assignedToUserId, startAt, endAt, appointmentId)) return { kind: "slot_conflict" as const };
    const meetingUrl = generateMeetingLink(`${rule.id}:${startAt.toISOString()}`);
    await tx.update(appointment).set({ startAt, endAt, meetingUrl, updatedAt: new Date() }).where(eq(appointment.id, appointmentId));
    await tx.insert(appointmentEvent).values({ appointmentId, actorUserId: userId, eventType: "RESCHEDULED", previousStartAt: existing.appointment.startAt, previousEndAt: existing.appointment.endAt, newStartAt: startAt, newEndAt: endAt });
    await tx.insert(crmContactActivity).values({ contactId: existing.appointment.contactId, actorUserId: userId, type: "APPOINTMENT_RESCHEDULED", metadata: { appointmentId, source: "learner_workspace" } });
    await tx.insert(auditLogs).values({ actorUserId: userId, action: "learner.appointment.reschedule", entityType: "appointment", entityId: appointmentId, metadata: { organizationId: rule.organizationId } });
    return { kind: "ok" as const, meetingUrl };
  });
}

// --- Admin-side availability management -------------------------------------------------------

export type AvailabilityRuleInput = {
  weekdays?: number[];
  specificDate?: string;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  type: string;
  sessionType: "INDIVIDUAL" | "GROUP";
  capacity: number;
};

async function adminOrganizationId(adminUserId: string) {
  const [row] = await db.select({ organizationId: organizationMembership.organizationId }).from(organizationMembership).where(and(eq(organizationMembership.userId, adminUserId), eq(organizationMembership.status, "ACTIVE"))).limit(1);
  return row?.organizationId ?? null;
}

export async function createAvailabilityRules(adminUserId: string, input: AvailabilityRuleInput) {
  const organizationId = await adminOrganizationId(adminUserId);
  if (!organizationId) return { kind: "no_organization" as const };
  const base = { organizationId, assignedToUserId: adminUserId, startMinute: input.startMinute, endMinute: input.endMinute, durationMinutes: input.durationMinutes, type: input.type, sessionType: input.sessionType, capacity: input.capacity };
  const rows = input.specificDate
    ? [{ ...base, weekday: null, specificDate: input.specificDate }]
    : (input.weekdays ?? []).map((weekday) => ({ ...base, weekday, specificDate: null }));
  if (!rows.length) return { kind: "invalid" as const };
  try {
    const inserted = await db.insert(appointmentAvailabilityRule).values(rows).returning();
    await db.insert(auditLogs).values({ actorUserId: adminUserId, action: "admin.availability.create", entityType: "appointment_availability_rule", entityId: inserted[0].id, metadata: { count: inserted.length, organizationId } });
    return { kind: "ok" as const, rules: inserted };
  } catch {
    return { kind: "conflict" as const };
  }
}

export type AdminAvailabilityRule = AvailabilityRule & {
  instances: { startAt: string; endAt: string; bookedCount: number; remainingCapacity: number }[];
};

export async function listAdminAvailabilityRules(adminUserId: string): Promise<AdminAvailabilityRule[]> {
  const rules = await db.select().from(appointmentAvailabilityRule).where(and(eq(appointmentAvailabilityRule.assignedToUserId, adminUserId), eq(appointmentAvailabilityRule.active, true))).orderBy(asc(appointmentAvailabilityRule.startMinute));
  if (!rules.length) return [];
  const from = new Date();
  const to = new Date(from.getTime() + ADMIN_WINDOW_DAYS * 86_400_000);
  const occupied = await db.select({ startAt: appointment.startAt, endAt: appointment.endAt }).from(appointment).where(and(eq(appointment.assignedToUserId, adminUserId), inArray(appointment.status, appointmentSlotConsumingStatuses), lt(appointment.startAt, to), gt(appointment.endAt, from)));
  const cursor = new Date(Date.UTC(tunisParts(from).year, tunisParts(from).month - 1, tunisParts(from).day));
  const byRule = new Map<string, AdminAvailabilityRule["instances"]>(rules.map((rule) => [rule.id, []]));
  for (let i = 0; i <= ADMIN_WINDOW_DAYS && cursor < to; i += 1, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth() + 1, day = cursor.getUTCDate(), weekday = cursor.getUTCDay();
    const key = dateKey(year, month, day);
    for (const rule of rules) {
      const dayMatches = rule.weekday !== null ? rule.weekday === weekday : rule.specificDate === key;
      if (!dayMatches) continue;
      for (let minute = rule.startMinute; minute + rule.durationMinutes <= rule.endMinute; minute += rule.durationMinutes) {
        const startAt = localToUtc(year, month, day, minute); const endAt = new Date(startAt.getTime() + rule.durationMinutes * 60_000);
        if (startAt <= new Date()) continue;
        const bookedCount = rule.sessionType === "GROUP"
          ? occupied.filter((row) => row.startAt.getTime() === startAt.getTime() && row.endAt.getTime() === endAt.getTime()).length
          : occupied.some((row) => row.startAt < endAt && row.endAt > startAt) ? 1 : 0;
        byRule.get(rule.id)?.push({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), bookedCount, remainingCapacity: Math.max(0, rule.capacity - bookedCount) });
      }
    }
  }
  return rules.map((rule) => ({ ...rule, instances: byRule.get(rule.id) ?? [] }));
}

export async function cancelAvailabilityRule(adminUserId: string, ruleId: string) {
  const result = await db.update(appointmentAvailabilityRule).set({ active: false, updatedAt: new Date() }).where(and(eq(appointmentAvailabilityRule.id, ruleId), eq(appointmentAvailabilityRule.assignedToUserId, adminUserId))).returning({ id: appointmentAvailabilityRule.id });
  if (!result.length) return { kind: "not_found" as const };
  await db.insert(auditLogs).values({ actorUserId: adminUserId, action: "admin.availability.cancel", entityType: "appointment_availability_rule", entityId: ruleId });
  return { kind: "ok" as const };
}

export { TIMEZONE, MAX_WINDOW_DAYS };
