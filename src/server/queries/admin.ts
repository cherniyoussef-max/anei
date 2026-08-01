import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  avsProfiles,
  contactMessages,
  courseModules,
  courses,
  enrollments,
  newsPosts,
  orders,
  resources,
  user,
  webinars,
} from "@/server/db/schema";

async function countUsers() { const [r] = await db.select({ value: count() }).from(user); return r?.value ?? 0; }
async function countCourses() { const [r] = await db.select({ value: count() }).from(courses); return r?.value ?? 0; }
async function countEnrollments() { const [r] = await db.select({ value: count() }).from(enrollments); return r?.value ?? 0; }
async function countOrders() { const [r] = await db.select({ value: count() }).from(orders); return r?.value ?? 0; }
async function countResources() { const [r] = await db.select({ value: count() }).from(resources); return r?.value ?? 0; }
async function countWebinars() { const [r] = await db.select({ value: count() }).from(webinars); return r?.value ?? 0; }
async function countAvs() { const [r] = await db.select({ value: count() }).from(avsProfiles); return r?.value ?? 0; }
async function countContacts() { const [r] = await db.select({ value: count() }).from(contactMessages); return r?.value ?? 0; }
async function countNews() { const [r] = await db.select({ value: count() }).from(newsPosts); return r?.value ?? 0; }

export async function getAdminDashboard() {
  const [users, courseCount, enrollmentCount, orderCount, resourceCount, webinarCount, avsCount, contactCount, newsCount] = await Promise.all([
    countUsers(),
    countCourses(),
    countEnrollments(),
    countOrders(),
    countResources(),
    countWebinars(),
    countAvs(),
    countContacts(),
    countNews(),
  ]);
  const [recentOrders, recentUsers, publishedCourses, moduleRows, recentContacts, recentNews] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(10),
    db.select().from(user).orderBy(desc(user.createdAt)).limit(10),
    db.select().from(courses).where(eq(courses.published, true)).orderBy(desc(courses.createdAt)).limit(10),
    db.select().from(courseModules).orderBy(desc(courseModules.createdAt)).limit(100),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(8),
    db.select().from(newsPosts).orderBy(desc(newsPosts.createdAt)).limit(8),
  ]);
  return { users, courseCount, enrollmentCount, orderCount, resourceCount, webinarCount, avsCount, contactCount, newsCount, recentOrders, recentUsers, publishedCourses, moduleRows, recentContacts, recentNews };
}

function adminPageBounds(page?: number, pageSize = 25) {
  const safePage = Number.isSafeInteger(page) && (page ?? 0) > 0 ? page! : 1;
  const safeSize = Math.min(100, Math.max(10, pageSize));
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}

export async function searchAdminUsers(input: { q?: string; role?: string; page?: number } = {}) {
  const { page, pageSize, offset } = adminPageBounds(input.page);
  const filters: SQL[] = [];
  const q = input.q?.trim().slice(0, 100);
  if (q) filters.push(or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`))!);
  if (["USER", "ADMIN", "SUPER_ADMIN"].includes(input.role ?? "")) filters.push(eq(user.role, input.role!));
  const where = filters.length ? and(...filters) : undefined;
  const [countRows, items] = await Promise.all([
    where
      ? db.select({ value: count() }).from(user).where(where)
      : db.select({ value: count() }).from(user),
    where
      ? db.select().from(user).where(where).orderBy(desc(user.createdAt)).limit(pageSize).offset(offset)
      : db.select().from(user).orderBy(desc(user.createdAt)).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function searchAdminOrders(input: { q?: string; status?: string; provider?: string; page?: number } = {}) {
  const { page, pageSize, offset } = adminPageBounds(input.page);
  const filters: SQL[] = [];
  const q = input.q?.trim().slice(0, 100);
  if (q) filters.push(or(ilike(orders.itemLabel, `%${q}%`), ilike(orders.id, `%${q}%`))!);
  if (["pending", "paid", "failed", "expired", "cancelled"].includes(input.status ?? "")) filters.push(eq(orders.status, input.status!));
  if (["mock", "flouci", "clicktopay", "free"].includes(input.provider ?? "")) filters.push(eq(orders.provider, input.provider!));
  const where = filters.length ? and(...filters) : undefined;
  const [countRows, items] = await Promise.all([
    where
      ? db.select({ value: count() }).from(orders).where(where)
      : db.select({ value: count() }).from(orders),
    where
      ? db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(pageSize).offset(offset)
      : db.select().from(orders).orderBy(desc(orders.createdAt)).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function searchAuditLogs(input: { q?: string; page?: number } = {}) {
  const { page, pageSize, offset } = adminPageBounds(input.page, 30);
  const q = input.q?.trim().slice(0, 100);
  const where = q
    ? or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.entityType, `%${q}%`), ilike(auditLogs.entityId, `%${q}%`))
    : undefined;
  const [countRows, items] = await Promise.all([
    where
      ? db.select({ value: count() }).from(auditLogs).where(where)
      : db.select({ value: count() }).from(auditLogs),
    where
      ? db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset)
      : db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
