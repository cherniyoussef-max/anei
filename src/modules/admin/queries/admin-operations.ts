import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { getRedis } from "@/server/cache/redis";
import { logger } from "@/server/security/logger";

interface OperationsCacheEntry<T> {
  data: T;
  expiresAt: number;
}
const memoryCache = new Map<string, OperationsCacheEntry<unknown>>();
const OPERATIONS_CACHE_TTL_MS = 60_000;

function pruneMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

async function withOperationsCache<T>(cacheKey: string, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const mem = memoryCache.get(cacheKey);
  if (mem && mem.expiresAt > now) {
    return mem.data as T;
  }

  try {
    const redis = await getRedis();
    if (redis) {
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        const parsed = JSON.parse(cached) as T;
        if (memoryCache.size > 100) pruneMemoryCache();
        memoryCache.set(cacheKey, { data: parsed, expiresAt: now + OPERATIONS_CACHE_TTL_MS });
        return parsed;
      }
    }
  } catch (error) {
    logger.error("admin.operations_cache_unavailable", { cacheKey, error: String(error) });
  }

  const value = await compute();
  if (memoryCache.size > 100) pruneMemoryCache();
  memoryCache.set(cacheKey, { data: value, expiresAt: now + OPERATIONS_CACHE_TTL_MS });

  try {
    const redis = await getRedis();
    if (redis) {
      redis.set(cacheKey, JSON.stringify(value), { EX: 60 }).catch(() => undefined);
    }
  } catch {
    // Non-blocking
  }

  return value;
}

type MetricRow = { total: number; secondary: number; tertiary: number; amount: number };

export async function getLearningOperations() {
  return withOperationsCache("admin:ops:learning", async () => {
    const result = await db.execute<MetricRow>(sql`select
      count(*)::int total,
      count(*) filter(where status='completed')::int secondary,
      coalesce(round(avg(progress_percent)),0)::int tertiary,
      0::int amount from enrollments`);
    return result.rows[0] ?? { total: 0, secondary: 0, tertiary: 0, amount: 0 };
  });
}

export async function getCourseOperations() {
  return withOperationsCache("admin:ops:courses", async () => {
    const result = await db.execute<MetricRow>(sql`select
      count(*)::int total, count(*) filter(where published)::int secondary,
      (select count(*)::int from enrollments)::int tertiary,
      (select count(*)::int from certificates)::int amount from courses`);
    return result.rows[0] ?? { total: 0, secondary: 0, tertiary: 0, amount: 0 };
  });
}

export async function getCommerceOperations() {
  return withOperationsCache("admin:ops:commerce", async () => {
    const result = await db.execute<MetricRow>(sql`select
      count(*)::int total, count(*) filter(where status='paid')::int secondary,
      count(*) filter(where status='pending')::int tertiary,
      coalesce(sum(amount_millimes) filter(where status='paid'),0)::int amount from orders`);
    return result.rows[0] ?? { total: 0, secondary: 0, tertiary: 0, amount: 0 };
  });
}

export async function getContentCounts() {
  return withOperationsCache("admin:ops:content", async () => {
    const result = await db.execute<{ courses:number; webinars:number; resources:number; news:number; contacts:number; certificates:number }>(sql`select
      (select count(*)::int from courses) courses,(select count(*)::int from webinars) webinars,
      (select count(*)::int from resources) resources,(select count(*)::int from news_posts) news,
      (select count(*)::int from contact_messages) contacts,(select count(*)::int from certificates) certificates`);
    return result.rows[0] ?? {courses:0,webinars:0,resources:0,news:0,contacts:0,certificates:0};
  });
}

export type AdminOrderItem = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  item_type: string;
  item_id: string;
  item_label: string;
  amount_millimes: number;
  currency: string;
  status: string;
  provider: string;
  created_at: Date | string;
};

export async function getAdminOrdersList(params: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = (page - 1) * limit;
  const q = params.q?.trim();
  const status = params.status?.trim();

  const searchFilter = q ? sql`and (o.id ilike ${`%${q}%`} or u.name ilike ${`%${q}%`} or u.email ilike ${`%${q}%`} or o.item_label ilike ${`%${q}%`})` : sql``;
  const statusFilter = status && status !== "all" ? sql`and o.status = ${status}` : sql``;

  const [itemsRes, totalRes, statsRes] = await Promise.all([
    db.execute<AdminOrderItem>(sql`
      select 
        o.id, o.user_id, u.name as user_name, u.email as user_email,
        o.item_type, o.item_id, o.item_label, o.amount_millimes, o.currency,
        o.status, o.provider, o.created_at
      from orders o
      join "user" u on u.id = o.user_id
      where 1=1 ${searchFilter} ${statusFilter}
      order by o.created_at desc
      limit ${limit} offset ${offset}
    `),
    db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from orders o
      join "user" u on u.id = o.user_id
      where 1=1 ${searchFilter} ${statusFilter}
    `),
    db.execute<{ total: number; paid: number; pending: number; failed: number; total_revenue: number }>(sql`
      select 
        count(*)::int as total,
        count(*) filter (where status = 'paid')::int as paid,
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where status in ('failed', 'cancelled', 'expired'))::int as failed,
        coalesce(sum(amount_millimes) filter (where status = 'paid'), 0)::int as total_revenue
      from orders
    `),
  ]);

  const total = totalRes.rows[0]?.count ?? 0;
  const stats = statsRes.rows[0] ?? { total: 0, paid: 0, pending: 0, failed: 0, total_revenue: 0 };

  return {
    items: itemsRes.rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export type AdminPaymentItem = {
  id: string;
  order_id: string;
  provider: string;
  external_payment_id: string | null;
  status: string;
  amount_millimes: number;
  checkout_url: string | null;
  created_at: Date | string;
  item_label: string;
  user_id: string;
  user_name: string;
  user_email: string;
};

export async function getAdminPaymentsList(params: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = (page - 1) * limit;
  const q = params.q?.trim();
  const status = params.status?.trim();

  const searchFilter = q ? sql`and (p.id ilike ${`%${q}%`} or p.order_id ilike ${`%${q}%`} or p.external_payment_id ilike ${`%${q}%`} or u.name ilike ${`%${q}%`} or u.email ilike ${`%${q}%`})` : sql``;
  const statusFilter = status && status !== "all" ? sql`and p.status = ${status}` : sql``;

  const [itemsRes, totalRes, statsRes] = await Promise.all([
    db.execute<AdminPaymentItem>(sql`
      select 
        p.id, p.order_id, p.provider, p.external_payment_id, p.status, p.amount_millimes, p.checkout_url, p.created_at,
        o.item_label, o.user_id, u.name as user_name, u.email as user_email
      from payments p
      join orders o on o.id = p.order_id
      join "user" u on u.id = o.user_id
      where 1=1 ${searchFilter} ${statusFilter}
      order by p.created_at desc
      limit ${limit} offset ${offset}
    `),
    db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from payments p
      join orders o on o.id = p.order_id
      join "user" u on u.id = o.user_id
      where 1=1 ${searchFilter} ${statusFilter}
    `),
    db.execute<{ total: number; paid: number; pending: number; failed: number; total_amount: number }>(sql`
      select 
        count(*)::int as total,
        count(*) filter (where status = 'paid')::int as paid,
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where status in ('failed', 'cancelled', 'expired'))::int as failed,
        coalesce(sum(amount_millimes) filter (where status = 'paid'), 0)::int as total_amount
      from payments
    `),
  ]);

  const total = totalRes.rows[0]?.count ?? 0;
  const stats = statsRes.rows[0] ?? { total: 0, paid: 0, pending: 0, failed: 0, total_amount: 0 };

  return {
    items: itemsRes.rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

