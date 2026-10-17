import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { getRedis } from "@/server/cache/redis";
import { logger } from "@/server/security/logger";

/**
 * Redis is non-authoritative: a connection failure, get/set failure, or a
 * corrupted cache value must all degrade to a direct DB read, not fail
 * the request.
 */
type UsersRedisClient = Awaited<ReturnType<typeof getRedis>>;
let redisResolver: () => Promise<UsersRedisClient> = getRedis;

interface UsersMemoryCacheEntry<T> {
  data: T;
  expiresAt: number;
}
const memoryCache = new Map<string, UsersMemoryCacheEntry<unknown>>();
const MEMORY_CACHE_TTL_MS = 60_000;

function pruneMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

export function clearAdminUsersMemoryCache() {
  memoryCache.clear();
}

/** Test-only seam, matching the pattern in src/server/security/rate-limit.ts. */
export function setAdminUsersRedisResolverForTests(resolver: (() => Promise<UsersRedisClient>) | null) {
  redisResolver = resolver ?? getRedis;
  memoryCache.clear();
}

async function getCacheClient(context: string) {
  return redisResolver().catch((error) => {
    logger.error("admin.users_cache_unavailable", { context, error: String(error) });
    return null;
  });
}

/**
 * Logs a corrupted/unparsable cache entry without ever including the cached
 * payload. Only the error name is recorded — JSON.parse's SyntaxError message
 * can embed a snippet of the malformed input, so String(error) is avoided.
 */
function logCacheCorrupt(context: string, error: unknown) {
  logger.error("admin.users_cache_corrupt", { context, error: error instanceof Error ? error.name : "unknown" });
}

export const userSortFields = ["joined", "name", "email", "role", "activity"] as const;
export type UserSort = (typeof userSortFields)[number];
export type SortDirection = "asc" | "desc";

export interface AdminUserFilters {
  q?: string; role?: string; provider?: string; status?: string;
  page?: number; pageSize?: number; sort?: string; direction?: string;
}

function normalize(input: AdminUserFilters) {
  const page = Number.isSafeInteger(input.page) && (input.page ?? 0) > 0 ? input.page! : 1;
  const pageSize = [10, 25, 50, 100].includes(input.pageSize ?? 25) ? input.pageSize! : 25;
  return {
    q: input.q?.trim().slice(0, 100),
    role: ["USER", "ADMIN", "SUPER_ADMIN"].includes(input.role ?? "") ? input.role : undefined,
    provider: ["credential", "google"].includes(input.provider ?? "") ? input.provider : undefined,
    status: ["active", "inactive"].includes(input.status ?? "") ? input.status : undefined,
    page, pageSize,
    sort: userSortFields.includes(input.sort as UserSort) ? input.sort as UserSort : "joined",
    direction: input.direction === "asc" ? "asc" as const : "desc" as const,
  };
}

const sortColumns: Record<UserSort, SQL> = {
  joined: sql`u.created_at`, name: sql`u.name`, email: sql`u.email`,
  role: sql`u.role`, activity: sql`last_activity`,
};

type UserListRow = {
  id: string; name: string; email: string; image: string | null; role: string;
  joined_at: Date; provider: string; last_activity: Date | null;
  enrollments: number; completion: number; total_count: number;
  profile_type?: string; professional_post_status?: string;
};

type AdminUsersPayload = {
  items: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: ReturnType<typeof normalize>;
};

type JsonRecord = Record<string, unknown>;
type AdminUserDetailPayload = {
  user: DetailRow;
  enrollments: JsonRecord[];
  sessions: JsonRecord[];
  certificates: JsonRecord[];
  videoProgress: JsonRecord[];
  quizAttempts: JsonRecord[];
  allCourses: Array<{ id: string; title_fr: string; title_ar: string }>;
  qualifyingCourses?: Array<{
    id: string;
    title_fr: string;
    title_ar: string;
    qualifying_target_type: string | null;
    qualifying_target_category: string | null;
  }>;
};

function parseCached<T>(value: string): T {
  return JSON.parse(value) as T;
}

function reviveDate(row: JsonRecord, key: string) {
  const value = row[key];
  if (typeof value === "string" || typeof value === "number") row[key] = new Date(value);
}

export async function getAdminUsers(input: AdminUserFilters = {}) {
  const filter = normalize(input);
  const cacheKey = `admin:users:list:${JSON.stringify(filter)}`;

  const now = Date.now();
  if (redisResolver === getRedis) {
    const mem = memoryCache.get(cacheKey);
    if (mem && mem.expiresAt > now) {
      const cloned = JSON.parse(JSON.stringify(mem.data)) as AdminUsersPayload;
      cloned.items.forEach((item) => {
        if (item.joined_at) item.joined_at = new Date(item.joined_at);
        if (item.last_activity) item.last_activity = new Date(item.last_activity);
      });
      return cloned;
    }
  }

  const redis = await getCacheClient("list");

  if (redis) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        const parsed = parseCached<AdminUsersPayload>(cached);
        if (memoryCache.size > 200) pruneMemoryCache();
        memoryCache.set(cacheKey, { data: parsed, expiresAt: now + MEMORY_CACHE_TTL_MS });
        parsed.items.forEach((item) => {
          if (item.joined_at) item.joined_at = new Date(item.joined_at);
          if (item.last_activity) item.last_activity = new Date(item.last_activity);
        });
        return parsed;
      } catch (error) {
        logCacheCorrupt("list", error);
      }
    }
  }

  const search = filter.q ? `%${filter.q}%` : null;
  const order = sortColumns[filter.sort];
  const direction = filter.direction === "asc" ? sql`asc` : sql`desc`;
  const offset = (filter.page - 1) * filter.pageSize;
  const result = await db.execute<UserListRow>(sql`
    with provider as (
      select user_id,
        case when bool_or(provider_id = 'google') then 'google' else 'credential' end provider
      from account group by user_id
    ), learning as (
      select user_id, count(*)::int enrollments,
        coalesce(round(avg(progress_percent)),0)::int completion,
        max(coalesce(completed_at, enrolled_at)) last_learning
      from enrollments group by user_id
    ), activity as (
      select user_id, max(updated_at) last_session from session group by user_id
    )
    select u.id, u.name, u.email, u.image, u.role, u.created_at joined_at,
      u.profile_type, coalesce(u.professional_post_status, 'LEARNER_ONLY') as professional_post_status,
      coalesce(p.provider,'credential') provider,
      greatest(a.last_session, l.last_learning) last_activity,
      coalesce(l.enrollments,0)::int enrollments, coalesce(l.completion,0)::int completion,
      count(*) over()::int total_count
    from "user" u
    left join provider p on p.user_id = u.id
    left join learning l on l.user_id = u.id
    left join activity a on a.user_id = u.id
    where (${search}::text is null or u.name ilike ${search} or u.email ilike ${search})
      and (${filter.role ?? null}::text is null or u.role = ${filter.role ?? null})
      and (${filter.provider ?? null}::text is null or coalesce(p.provider,'credential') = ${filter.provider ?? null})
      and (${filter.status ?? null}::text is null or
        (${filter.status ?? null} = 'active' and a.last_session >= now() - interval '30 days') or
        (${filter.status ?? null} = 'inactive' and (a.last_session is null or a.last_session < now() - interval '30 days')))
    order by ${order} ${direction} nulls last, u.id
    limit ${filter.pageSize} offset ${offset}
  `);
  const total = result.rows[0]?.total_count ?? 0;
  const payload = { items: result.rows, total, page: filter.page, pageSize: filter.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)), filters: filter };
    
  if (memoryCache.size > 200) pruneMemoryCache();
  memoryCache.set(cacheKey, { data: payload, expiresAt: now + MEMORY_CACHE_TTL_MS });

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(payload), { EX: 60 }).catch(() => undefined);
  }

  return payload;
}

type DetailRow = UserListRow & {
  profile_type: string;
  locale: string;
  email_verified: boolean;
  professional_post_status: string;
  phone_number: string | null;
  phone_verified_at: Date | string | null;
  governorate: string | null;
  city: string | null;
  certificates: number;
  webinars: number;
  paid_millimes: number;
};
export async function getAdminUserDetail(id: string) {
  const cacheKey = `admin:users:detail:${id}`;

  const now = Date.now();
  if (redisResolver === getRedis) {
    const mem = memoryCache.get(cacheKey);
    if (mem && mem.expiresAt > now) {
      const parsed = JSON.parse(JSON.stringify(mem.data)) as AdminUserDetailPayload;
      if (parsed.user?.joined_at) parsed.user.joined_at = new Date(parsed.user.joined_at);
      if (parsed.user?.last_activity) parsed.user.last_activity = new Date(parsed.user.last_activity);
      parsed.enrollments.forEach((row) => { reviveDate(row, "enrolled_at"); reviveDate(row, "completed_at"); });
      parsed.sessions.forEach((row) => { reviveDate(row, "created_at"); reviveDate(row, "updated_at"); reviveDate(row, "expires_at"); });
      parsed.certificates.forEach((row) => reviveDate(row, "issued_at"));
      parsed.videoProgress.forEach((row) => reviveDate(row, "updated_at"));
      parsed.quizAttempts?.forEach((row) => { reviveDate(row, "started_at"); reviveDate(row, "submitted_at"); });
      return parsed;
    }
  }

  const redis = await getCacheClient("detail");

  if (redis) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        const parsed = parseCached<AdminUserDetailPayload>(cached);
        if (memoryCache.size > 200) pruneMemoryCache();
        memoryCache.set(cacheKey, { data: parsed, expiresAt: now + MEMORY_CACHE_TTL_MS });
        if (parsed.user?.joined_at) parsed.user.joined_at = new Date(parsed.user.joined_at);
        if (parsed.user?.last_activity) parsed.user.last_activity = new Date(parsed.user.last_activity);
        parsed.enrollments.forEach((row) => { reviveDate(row, "enrolled_at"); reviveDate(row, "completed_at"); });
        parsed.sessions.forEach((row) => { reviveDate(row, "created_at"); reviveDate(row, "updated_at"); reviveDate(row, "expires_at"); });
        parsed.certificates.forEach((row) => reviveDate(row, "issued_at"));
        parsed.videoProgress.forEach((row) => reviveDate(row, "updated_at"));
        parsed.quizAttempts?.forEach((row) => { reviveDate(row, "started_at"); reviveDate(row, "submitted_at"); });
        return parsed;
      } catch (error) {
        logCacheCorrupt("detail", error);
      }
    }
  }

  const result = await db.execute<DetailRow>(sql`
    select u.id,u.name,u.email,u.image,u.role,u.created_at joined_at,u.profile_type,u.locale,u.email_verified,
      coalesce(u.professional_post_status, 'LEARNER_ONLY') as professional_post_status,
      up.phone_number, up.phone_verified_at, up.governorate, up.city,
      coalesce((select case when bool_or(provider_id='google') then 'google' else 'credential' end from account where user_id=u.id),'credential') provider,
      (select max(updated_at) from session where user_id=u.id) last_activity,
      (select count(*)::int from enrollments where user_id=u.id) enrollments,
      coalesce((select round(avg(progress_percent))::int from enrollments where user_id=u.id),0) completion,
      (select count(*)::int from certificates where user_id=u.id) certificates,
      (select count(*)::int from webinar_registrations where user_id=u.id) webinars,
      coalesce((select sum(amount_millimes)::int from orders where user_id=u.id and status='paid'),0) paid_millimes,
      1::int total_count
    from "user" u
    left join user_profile up on up.user_id = u.id
    where u.id=${id} limit 1
  `);
  if (!result.rows[0]) return null;
  const [enrollments, sessions, certificates, videoProgress, quizAttempts, allCourses, qualifyingCourses] = await Promise.all([
    db.execute(sql`select e.id,e.status,e.progress_percent,e.enrolled_at,e.completed_at,c.id course_id,c.title_fr,c.title_ar from enrollments e join courses c on c.id=e.course_id where e.user_id=${id} order by e.enrolled_at desc limit 100`),
    db.execute(sql`select id,created_at,updated_at,expires_at,ip_address,user_agent from session where user_id=${id} order by updated_at desc limit 50`),
    db.execute(sql`select c.id,c.code,c.issued_at,co.title_fr,co.title_ar from certificates c join courses co on co.id=c.course_id where c.user_id=${id} order by c.issued_at desc limit 100`),
    db.execute(sql`select lp.id, lp.watched_seconds, lp.completed, lp.updated_at, l.title_fr, l.title_ar, coalesce(l.duration_seconds, 0) as duration_seconds, c.title_fr as course_fr, c.title_ar as course_ar from lesson_progress lp join lessons l on l.id = lp.lesson_id join enrollments e on e.id = lp.enrollment_id join courses c on c.id = l.course_id where e.user_id=${id} order by lp.updated_at desc limit 100`),
    db.execute(sql`select t.id, t.assessment_id, t.attempt_number, t.status, t.raw_points, t.max_points, t.percentage, t.passed, t.started_at, t.submitted_at, a.title_fr as assessment_title_fr, a.title_ar as assessment_title_ar, c.id as course_id, c.title_fr as course_title_fr, c.title_ar as course_title_ar from learning_attempt t join learning_assessment a on a.id = t.assessment_id join courses c on c.id = a.course_id where t.user_id=${id} and t.status = 'GRADED' order by t.submitted_at desc limit 50`),
    db.execute<{ id: string; title_fr: string; title_ar: string }>(sql`select id, title_fr, title_ar from courses order by title_fr asc`),
    db.execute<{ id: string; title_fr: string; title_ar: string; qualifying_target_type: string | null; qualifying_target_category: string | null }>(sql`select id, title_fr, title_ar, qualifying_target_type, qualifying_target_category from courses where qualifies_for_professional_promotion = true order by title_fr asc`),
  ]);
  const payload: AdminUserDetailPayload = { user: result.rows[0], enrollments: enrollments.rows, sessions: sessions.rows, certificates: certificates.rows, videoProgress: videoProgress.rows, quizAttempts: quizAttempts.rows, allCourses: allCourses.rows, qualifyingCourses: qualifyingCourses.rows };
  
  if (memoryCache.size > 200) pruneMemoryCache();
  memoryCache.set(cacheKey, { data: payload, expiresAt: now + MEMORY_CACHE_TTL_MS });

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(payload), { EX: 60 }).catch(() => undefined);
  }

  return payload;
}
