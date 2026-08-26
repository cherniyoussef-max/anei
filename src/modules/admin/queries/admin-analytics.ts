import "server-only";
import { sql } from "drizzle-orm";
import { logger } from "@/server/security/logger";
import { db } from "@/server/db";
import { getRedis } from "@/server/cache/redis";

export type AdminPeriod = "7d" | "30d" | "90d" | "365d";
const periodDays: Record<AdminPeriod, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

export function parseAdminPeriod(value?: string): AdminPeriod {
  return value && value in periodDays ? value as AdminPeriod : "30d";
}

type DashboardRedisClient = Awaited<ReturnType<typeof getRedis>>;
let redisResolver: () => Promise<DashboardRedisClient> = getRedis;

/** Test-only seam, matching the pattern in src/server/security/rate-limit.ts. */
export function setAdminDashboardRedisResolverForTests(resolver: (() => Promise<DashboardRedisClient>) | null) {
  redisResolver = resolver ?? getRedis;
}

/**
 * Cache-aside helper for the dashboard overview queries, matching the
 * pattern in admin-users.ts. These are heavy multi-subquery aggregations
 * hit on every /admin landing-page load; 60s TTL keeps the dashboard close
 * to real-time while avoiding a full re-aggregation on every request.
 * Redis is non-authoritative: a connection failure, get/set failure, or a
 * corrupted cache value must all degrade to a direct DB read, not fail
 * the request.
 */
async function withDashboardCache<T>(cacheKey: string, compute: () => Promise<T>): Promise<T> {
  const redis = await redisResolver().catch((error) => {
    logger.error("admin.dashboard_cache_unavailable", { cacheKey, error: String(error) });
    return null;
  });
  if (redis) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch (error) {
        // JSON.parse's SyntaxError message can embed a snippet of the malformed
        // input, so only the error name is logged — never String(error) or the
        // cached value itself.
        logger.error("admin.dashboard_cache_corrupt", { cacheKey, error: error instanceof Error ? error.name : "unknown" });
      }
    }
  }
  const value = await compute();
  if (redis) await redis.set(cacheKey, JSON.stringify(value), { EX: 60 }).catch(() => undefined);
  return value;
}

type OverviewRow = {
  total_users: number; new_users: number; active_learners: number;
  published_courses: number; enrollments: number; completed_enrollments: number;
  certificates: number; upcoming_webinars: number; pending_contacts: number;
  revenue_millimes: number; successful_payments: number; failed_payments: number;
};

export async function getAdminOverview(period: AdminPeriod) {
  return withDashboardCache(`admin:overview:${period}`, () => computeAdminOverview(period));
}

async function computeAdminOverview(period: AdminPeriod) {
  const days = periodDays[period];
  const result = await db.execute<OverviewRow>(sql`
    select
      (select count(*)::int from "user") as total_users,
      (select count(*)::int from "user" where created_at >= now() - (${days} * interval '1 day')) as new_users,
      (select count(distinct user_id)::int from enrollments where status = 'active') as active_learners,
      (select count(*)::int from courses where published = true) as published_courses,
      (select count(*)::int from enrollments) as enrollments,
      (select count(*)::int from enrollments where status = 'completed') as completed_enrollments,
      (select count(*)::int from certificates) as certificates,
      (select count(*)::int from webinars where published = true and starts_at >= now()) as upcoming_webinars,
      (select count(*)::int from contact_messages where status = 'new') as pending_contacts,
      (select coalesce(sum(amount_millimes),0)::int from orders where status = 'paid'
        and created_at >= now() - (${days} * interval '1 day')) as revenue_millimes,
      (select count(*)::int from payments where status = 'paid'
        and created_at >= now() - (${days} * interval '1 day')) as successful_payments,
      (select count(*)::int from payments where status = 'failed'
        and created_at >= now() - (${days} * interval '1 day')) as failed_payments
  `);
  const row = result.rows[0];
  return {
    period,
    totalUsers: row?.total_users ?? 0,
    newUsers: row?.new_users ?? 0,
    activeLearners: row?.active_learners ?? 0,
    publishedCourses: row?.published_courses ?? 0,
    enrollments: row?.enrollments ?? 0,
    completionRate: row?.enrollments ? Math.round((row.completed_enrollments / row.enrollments) * 1000) / 10 : 0,
    certificatesIssued: row?.certificates ?? 0,
    upcomingWebinars: row?.upcoming_webinars ?? 0,
    pendingContacts: row?.pending_contacts ?? 0,
    revenueMillimes: row?.revenue_millimes ?? 0,
    successfulPayments: row?.successful_payments ?? 0,
    failedPayments: row?.failed_payments ?? 0,
  };
}

type GrowthRow = { bucket: Date; users: number; enrollments: number };
export async function getAdminGrowth(period: AdminPeriod) {
  const rows = await withDashboardCache(`admin:growth:${period}`, () => computeAdminGrowth(period));
  return rows.map((row) => ({ ...row, date: new Date(row.date) }));
}

async function computeAdminGrowth(period: AdminPeriod) {
  const days = periodDays[period];
  const result = await db.execute<GrowthRow>(sql`
    with buckets as (
      select generate_series(
        date_trunc('day', now() - (${days - 1} * interval '1 day')),
        date_trunc('day', now()), interval '1 day'
      ) as bucket
    ), u as (
      select date_trunc('day', created_at) bucket, count(*)::int value
      from "user" where created_at >= now() - (${days} * interval '1 day') group by 1
    ), e as (
      select date_trunc('day', enrolled_at) bucket, count(*)::int value
      from enrollments where enrolled_at >= now() - (${days} * interval '1 day') group by 1
    )
    select buckets.bucket, coalesce(u.value,0)::int users, coalesce(e.value,0)::int enrollments
    from buckets left join u using(bucket) left join e using(bucket) order by buckets.bucket
  `);
  return result.rows.map((row) => ({ date: row.bucket, users: row.users, enrollments: row.enrollments }));
}

type DistributionRow = { label: string; value: number; id?: string };
export async function getAdminDistributions() {
  return withDashboardCache("admin:distributions", computeAdminDistributions);
}

async function computeAdminDistributions() {
  const [roles, providers, courses] = await Promise.all([
    db.execute<DistributionRow>(sql`select role label, count(*)::int value from "user" group by role order by value desc`),
    db.execute<DistributionRow>(sql`
      select case when provider_id = 'credential' then 'email' else provider_id end label,
        count(distinct user_id)::int value
      from account group by 1 order by value desc
    `),
    db.execute<DistributionRow>(sql`
      select c.id, c.title_fr label, count(e.id)::int value from courses c
      left join enrollments e on e.course_id = c.id
      group by c.id, c.title_fr order by value desc, c.title_fr limit 6
    `),
  ]);
  return { roles: roles.rows, providers: providers.rows, topCourses: courses.rows };
}
