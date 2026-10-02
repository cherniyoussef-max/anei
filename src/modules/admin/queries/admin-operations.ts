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
