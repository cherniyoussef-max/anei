import { and, count, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsProfiles, courses, resources, webinars } from "@/server/db/schema";
import { getRedis } from "@/server/cache/redis";

const HOME_STATS_CACHE_KEY = "cache:home:stats";
const HOME_STATS_TTL = 120; // 2 minutes

let memoryCache: { data: { courses: number; webinars: number; avs: number; resources: number }; expiresAt: number } | null = null;

async function fetchHomeStatsFromDb() {
  const [[courseRow], [webinarRow], [avsRow], [resourceRow]] = await Promise.all([
    db.select({ value: count() }).from(courses).where(eq(courses.published, true)),
    db.select({ value: count() }).from(webinars).where(eq(webinars.published, true)),
    db.select({ value: count() }).from(avsProfiles).where(and(eq(avsProfiles.visible, true), eq(avsProfiles.certified, true))),
    db.select({ value: count() }).from(resources).where(eq(resources.published, true)),
  ]);
  return {
    courses: courseRow?.value ?? 0,
    webinars: webinarRow?.value ?? 0,
    avs: avsRow?.value ?? 0,
    resources: resourceRow?.value ?? 0,
  };
}

export async function getHomeStats() {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.data;
  }

  try {
    const redis = await getRedis();
    if (redis) {
      const cached = await redis.get(HOME_STATS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        memoryCache = { data: parsed, expiresAt: now + 60_000 };
        return parsed;
      }
    }
  } catch {
    // Redis unavailable: fall back to DB
  }

  const stats = await fetchHomeStatsFromDb();
  memoryCache = { data: stats, expiresAt: now + 60_000 };

  try {
    const redis = await getRedis();
    if (redis) {
      await redis.set(HOME_STATS_CACHE_KEY, JSON.stringify(stats), { EX: HOME_STATS_TTL });
    }
  } catch {
    // Non-blocking cache write failure
  }

  return stats;
}
