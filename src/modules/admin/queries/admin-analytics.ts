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

interface MemoryCacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry<unknown>>();
const MEMORY_CACHE_TTL_MS = 60_000;

function pruneMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

export function clearAdminDashboardMemoryCacheForTests() {
  memoryCache.clear();
}

/** Test-only seam, matching the pattern in src/server/security/rate-limit.ts. */
export function setAdminDashboardRedisResolverForTests(resolver: (() => Promise<DashboardRedisClient>) | null) {
  redisResolver = resolver ?? getRedis;
  memoryCache.clear();
}

/**
 * Cache-aside helper for the dashboard overview queries, matching the
 * pattern in admin-users.ts. Multi-tier L1 (memory) + L2 (Redis) caching:
 * sub-millisecond in-process hits with Redis fallback across instances.
 * 60s TTL keeps the dashboard close to real-time while avoiding repeated
 * multi-subquery DB aggregations.
 * Cache is non-authoritative: a connection failure, get/set failure, or a
 * corrupted cache value must all degrade to a direct DB read, not fail
 * the request.
 */
async function withDashboardCache<T>(cacheKey: string, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (redisResolver === getRedis) {
    const mem = memoryCache.get(cacheKey);
    if (mem && mem.expiresAt > now) {
      return mem.data as T;
    }
  }

  const redis = await redisResolver().catch((error) => {
    logger.error("admin.dashboard_cache_unavailable", { cacheKey, error: String(error) });
    return null;
  });
  if (redis) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as T;
        if (memoryCache.size > 200) pruneMemoryCache();
        memoryCache.set(cacheKey, { data: parsed, expiresAt: now + MEMORY_CACHE_TTL_MS });
        return parsed;
      } catch (error) {
        // JSON.parse's SyntaxError message can embed a snippet of the malformed
        // input, so only the error name is logged — never String(error) or the
        // cached value itself.
        logger.error("admin.dashboard_cache_corrupt", { cacheKey, error: error instanceof Error ? error.name : "unknown" });
      }
    }
  }
  const value = await compute();
  if (memoryCache.size > 200) pruneMemoryCache();
  memoryCache.set(cacheKey, { data: value, expiresAt: now + MEMORY_CACHE_TTL_MS });
  if (redis) await redis.set(cacheKey, JSON.stringify(value), { EX: 60 }).catch(() => undefined);
  return value;
}

let avsBookingColumnsChecked = false;
async function ensureAvsBookingColumns() {
  if (avsBookingColumnsChecked) return;
  try {
    await db.execute(sql`
      ALTER TABLE "avs_booking_requests"
        ADD COLUMN IF NOT EXISTS "amount_millimes" integer NOT NULL DEFAULT 35000,
        ADD COLUMN IF NOT EXISTS "platform_fee_millimes" integer NOT NULL DEFAULT 3500,
        ADD COLUMN IF NOT EXISTS "avs_payout_millimes" integer NOT NULL DEFAULT 31500,
        ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'HELD_IN_ESCROW',
        ADD COLUMN IF NOT EXISTS "payment_method" text,
        ADD COLUMN IF NOT EXISTS "payment_reference" text,
        ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "escrow_released_at" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "refunded_at" timestamp with time zone;
    `);
    avsBookingColumnsChecked = true;
  } catch (error) {
    logger.warn("admin.ensure_avs_columns_warning", { error: String(error) });
  }
}

type OverviewRow = {
  total_users: number; new_users: number; active_learners: number;
  published_courses: number; enrollments: number; completed_enrollments: number;
  certificates: number; upcoming_webinars: number; pending_contacts: number;
  revenue_millimes: number; successful_payments: number; failed_payments: number;
  active_escrow_millimes?: number; platform_commissions_millimes?: number;
  in_person_consultations_count?: number; candidates_under_review_count: number;
  passed_interviews_count: number; approved_practitioners_count: number;
  course_sales_count: number;
  webinar_registrations_count: number;
  webinar_to_course_conversions_count: number;
};

export async function getAdminOverview(period: AdminPeriod) {
  return withDashboardCache(`admin:overview:${period}`, () => computeAdminOverview(period));
}

async function computeAdminOverview(period: AdminPeriod) {
  await ensureAvsBookingColumns();
  const days = periodDays[period];

  let row: Partial<OverviewRow> = {};
  try {
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
          and created_at >= now() - (${days} * interval '1 day')) as failed_payments,
        (select count(*)::int from "user" where professional_post_status = 'CANDIDATE_UNDER_REVIEW') as candidates_under_review_count,
        (select count(*)::int from practitioner_promotions where interview_status = 'PASSED') as passed_interviews_count,
        (select count(*)::int from "user" where professional_post_status in ('APPROVED_AVS', 'APPROVED_SPECIALIST')) as approved_practitioners_count,
        (select count(*)::int from orders where status = 'paid') as course_sales_count,
        (select count(*)::int from webinar_registrations) as webinar_registrations_count,
        (select count(distinct e.user_id)::int from webinar_registrations wr
          inner join webinars w on w.id = wr.webinar_id
          inner join enrollments e on e.user_id = wr.user_id and e.course_id = w.course_id
          where w.course_id is not null) as webinar_to_course_conversions_count
    `);
    row = result.rows[0] ?? {};
  } catch (error) {
    logger.error("admin.overview_primary_query_failed", { error: String(error) });
  }

  // Safe isolated query for booking / escrow metrics so column drift never breaks the dashboard
  let activeEscrowMillimes = 0;
  let platformCommissionsMillimes = 0;
  let inPersonConsultationsCount = 0;
  try {
    const avsMetrics = await db.execute<{
      active_escrow: number;
      commissions: number;
      in_person: number;
    }>(sql`
      select
        coalesce(sum(case when escrow_status = 'HELD_IN_ESCROW' then amount_millimes else 0 end), 0)::int as active_escrow,
        coalesce(sum(case when status in ('CONFIRMED', 'COMPLETED') then platform_fee_millimes else 0 end), 0)::int as commissions,
        coalesce(sum(case when payment_mode = 'PAY_ON_SITE' then 1 else 0 end), 0)::int as in_person
      from avs_booking_requests
    `);
    if (avsMetrics.rows[0]) {
      activeEscrowMillimes = avsMetrics.rows[0].active_escrow ?? 0;
      platformCommissionsMillimes = avsMetrics.rows[0].commissions ?? 0;
      inPersonConsultationsCount = avsMetrics.rows[0].in_person ?? 0;
    }
  } catch (error) {
    logger.warn("admin.overview_avs_metrics_fallback", { error: String(error) });
  }

  const webinarRegistrationsCount = row?.webinar_registrations_count ?? 0;
  const webinarToCourseConversionsCount = row?.webinar_to_course_conversions_count ?? 0;
  const webinarConversionRate = webinarRegistrationsCount > 0
    ? Math.round((webinarToCourseConversionsCount / webinarRegistrationsCount) * 1000) / 10
    : 0;

  return {
    period,
    totalUsers: row?.total_users ?? 0,
    newUsers: row?.new_users ?? 0,
    activeLearners: row?.active_learners ?? 0,
    publishedCourses: row?.published_courses ?? 0,
    enrollments: row?.enrollments ?? 0,
    completionRate: row?.enrollments ? Math.round(((row.completed_enrollments ?? 0) / row.enrollments) * 1000) / 10 : 0,
    certificatesIssued: row?.certificates ?? 0,
    upcomingWebinars: row?.upcoming_webinars ?? 0,
    pendingContacts: row?.pending_contacts ?? 0,
    revenueMillimes: row?.revenue_millimes ?? 0,
    successfulPayments: row?.successful_payments ?? 0,
    failedPayments: row?.failed_payments ?? 0,
    activeEscrowMillimes,
    platformCommissionsMillimes,
    inPersonConsultationsCount,
    candidatesUnderReviewCount: row?.candidates_under_review_count ?? 0,
    passedInterviewsCount: row?.passed_interviews_count ?? 0,
    approvedPractitionersCount: row?.approved_practitioners_count ?? 0,
    courseSalesCount: row?.course_sales_count ?? 0,
    webinarRegistrationsCount,
    webinarToCourseConversionsCount,
    webinarConversionRate,
  };
}

type GrowthRow = { bucket: Date; users: number; enrollments: number };
export async function getAdminGrowth(period: AdminPeriod) {
  const rows = await withDashboardCache(`admin:growth:${period}`, () => computeAdminGrowth(period));
  return rows.map((row) => ({ ...row, date: new Date(row.date) }));
}

async function computeAdminGrowth(period: AdminPeriod) {
  const days = periodDays[period];
  try {
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
  } catch (error) {
    logger.error("admin.growth_failed", { error: String(error) });
    return [];
  }
}

type DistributionRow = { label: string; value: number; id?: string };
export async function getAdminDistributions() {
  return withDashboardCache("admin:distributions", computeAdminDistributions);
}

async function computeAdminDistributions() {
  try {
    const [roles, providers, courses, governorates, disciplines] = await Promise.all([
      db.execute<DistributionRow>(sql`select role label, count(*)::int value from "user" group by role order by value desc`).catch(() => ({ rows: [] })),
      db.execute<DistributionRow>(sql`
        select case when provider_id = 'credential' then 'email' else provider_id end label,
          count(distinct user_id)::int value
        from account group by 1 order by value desc
      `).catch(() => ({ rows: [] })),
      db.execute<DistributionRow>(sql`
        select c.id, c.title_fr label, count(e.id)::int value from courses c
        left join enrollments e on e.course_id = c.id
        group by c.id, c.title_fr order by value desc, c.title_fr limit 6
      `).catch(() => ({ rows: [] })),
      db.execute<DistributionRow>(sql`
        select coalesce(governorate_fr, 'Tunis') label, count(*)::int value
        from avs_profiles where visible = true
        group by 1 order by value desc limit 8
      `).catch(() => ({ rows: [] })),
      db.execute<DistributionRow>(sql`
        select case when directory_type = 'AVS' then 'AVS / Accompagnant' else coalesce(category, 'Spécialiste') end label,
          count(*)::int value
        from avs_profiles where visible = true
        group by 1 order by value desc limit 8
      `).catch(() => ({ rows: [] })),
    ]);
    return {
      roles: roles.rows,
      providers: providers.rows,
      topCourses: courses.rows,
      governorates: governorates.rows,
      disciplines: disciplines.rows,
    };
  } catch (error) {
    logger.error("admin.distributions_failed", { error: String(error) });
    return { roles: [], providers: [], topCourses: [], governorates: [], disciplines: [] };
  }
}

// -----------------------------------------------------------------------------
// Onboarding & Demographic Intelligence (Sprint Master v3.3.0 - Wizard Analytics)
// -----------------------------------------------------------------------------

export type OnboardingAnalyticsData = {
  categories: { label: string; count: number; percentage: number }[];
  subSpecialties: { label: string; count: number }[];
  territorialBalancing: {
    governorate: string;
    learnersCount: number;
    practitionersCount: number;
    ratio: string;
  }[];
  pathologiesCoverage: {
    name: string;
    learnersDemand: number;
    practitionersSupply: number;
  }[];
  acquisitionSources: { source: string; label: string; count: number; percentage: number }[];
};

export async function getAdminOnboardingAnalytics(): Promise<OnboardingAnalyticsData> {
  return withDashboardCache("admin:onboarding:analytics", computeAdminOnboardingAnalytics);
}

async function computeAdminOnboardingAnalytics(): Promise<OnboardingAnalyticsData> {
  try {
    const [categoriesRes, subSpecialtiesRes, territorialRes, sourcesRes, pathologiesRes] = await Promise.all([
      db.execute<{ category: string; count: number }>(sql`
        select
          coalesce(o.category, case when u.profile_type = 'avs' then 'AVS' when u.profile_type = 'specialist' then 'SPECIALIST' else 'LEARNER' end) as category,
          count(*)::int as count
        from "user" u
        left join user_onboarding_analytics o on o.user_id = u.id
        group by 1
        order by count desc
      `).catch(() => ({ rows: [] })),
      db.execute<{ label: string; count: number }>(sql`
        select coalesce(category, specialty_fr) as label, count(*)::int as count
        from avs_profiles
        where visible = true and directory_type = 'SPECIALIST'
        group by 1
        order by count desc
        limit 6
      `).catch(() => ({ rows: [] })),
      db.execute<{ governorate: string; learners_count: number; practitioners_count: number }>(sql`
        with learner_gov as (
          select coalesce(o.governorate, p.governorate, 'Tunis') as gov, count(*)::int as cnt
          from "user" u
          left join user_onboarding_analytics o on o.user_id = u.id
          left join user_profile p on p.user_id = u.id
          where coalesce(o.category, u.profile_type) in ('LEARNER', 'learner', 'parent')
          group by 1
        ),
        practitioner_gov as (
          select coalesce(governorate_fr, 'Tunis') as gov, count(*)::int as cnt
          from avs_profiles
          where visible = true
          group by 1
        )
        select
          coalesce(l.gov, p.gov) as governorate,
          coalesce(l.cnt, 0)::int as learners_count,
          coalesce(p.cnt, 0)::int as practitioners_count
        from learner_gov l
        full outer join practitioner_gov p on l.gov = p.gov
        order by learners_count desc, practitioners_count desc
        limit 8
      `).catch(() => ({ rows: [] })),
      db.execute<{ source: string; count: number }>(sql`
        select
          coalesce(acquisition_source, 'DIRECT') as source,
          count(*)::int as count
        from user_onboarding_analytics
        group by 1
        order by count desc
      `).catch(() => ({ rows: [] })),
      db.execute<{ name: string; learners_count: number; practitioners_count: number }>(sql`
        with p_list as (
          select unnest(array['Autisme (TSA)', 'Troubles DYS', 'TDAH', 'Trisomie 21', 'Retard de langage', 'Troubles sensoriels']) as name
        )
        select
          p.name,
          coalesce((select count(*)::int from user_onboarding_analytics o where p.name = any(o.pathologies)), 0) as learners_count,
          coalesce((select count(*)::int from avs_profiles a where a.visible = true and p.name = any(a.intervention_domains)), 0) as practitioners_count
        from p_list p
        order by learners_count desc, practitioners_count desc
      `).catch(() => ({ rows: [] })),
    ]);

    const totalUsers = categoriesRes.rows.reduce((sum, r) => sum + r.count, 0) || 1;
    const categories = categoriesRes.rows.map((r) => {
      const label = r.category === "LEARNER"
        ? "Apprenants & Familles"
        : r.category === "AVS"
        ? "Accompagnants AVS"
        : "Spécialistes Cliniciens";
      return {
        label,
        count: r.count,
        percentage: Math.round((r.count / totalUsers) * 100),
      };
    });

    const totalSources = sourcesRes.rows.reduce((sum, r) => sum + r.count, 0) || 1;
    const sourceLabels: Record<string, string> = {
      FACEBOOK_INSTAGRAM: "Meta Ads (Facebook / Instagram)",
      WHATSAPP: "WhatsApp Direct",
      RECOMMENDATION: "Recommandation médicale / scolaire",
      GOOGLE: "Recherche Google",
      WEBINAR: "Webinaires ANEI",
      WORD_OF_MOUTH: "Bouche-à-oreille",
      DIRECT: "Accès Direct",
    };

    const acquisitionSources = (sourcesRes.rows.length > 0 ? sourcesRes.rows : [{ source: "DIRECT", count: 1 }]).map((r) => ({
      source: r.source,
      label: sourceLabels[r.source] || r.source,
      count: r.count,
      percentage: Math.round((r.count / totalSources) * 100),
    }));

    const territorialBalancing = territorialRes.rows.map((r) => {
      const l = r.learners_count;
      const p = r.practitioners_count;
      let ratio = "Équilibré";
      if (p === 0 && l > 0) ratio = "Déficit (0 praticien)";
      else if (p > 0 && l / p > 10) ratio = "Tension Forte";
      else if (p > 0) ratio = `1 / ${Math.round(l / p || 1)}`;

      return {
        governorate: r.governorate,
        learnersCount: l,
        practitionersCount: p,
        ratio,
      };
    });

    const pathologiesCoverage = pathologiesRes.rows.map((r) => ({
      name: r.name,
      learnersDemand: r.learners_count,
      practitionersSupply: r.practitioners_count,
    }));

    return {
      categories,
      subSpecialties: subSpecialtiesRes.rows,
      territorialBalancing,
      pathologiesCoverage,
      acquisitionSources,
    };
  } catch (error) {
    logger.error("admin.onboarding_analytics_failed", { error: String(error) });
    return {
      categories: [],
      subSpecialties: [],
      territorialBalancing: [],
      pathologiesCoverage: [],
      acquisitionSources: [],
    };
  }
}

// -----------------------------------------------------------------------------
// Marketing & Audience Intelligence (Phase 7 - Data Analysis for Marketing & Engagement)
// -----------------------------------------------------------------------------

export type MarketingOverviewStats = {
  totalRegistered: number;
  activeLast30d: number;
  dormantUsers: number;
  phoneProvidedCount: number;
  phoneVerifiedCount: number;
  emailVerifiedCount: number;
  onboardingCompletedCount: number;
  retentionRatePercent: number;
};

export type CourseEngagementStat = {
  id: string;
  title: string;
  enrollments: number;
  completed: number;
  completionRate: number;
  avgProgress: number;
  dropOffs: number;
};

export type MarketingDistributionItem = {
  label: string;
  count: number;
  percentage: number;
};

export type MarketingAnalyticsPayload = {
  stats: MarketingOverviewStats;
  governorates: MarketingDistributionItem[];
  personas: MarketingDistributionItem[];
  educationLevels: MarketingDistributionItem[];
  topCourses: CourseEngagementStat[];
  strugglingCourses: CourseEngagementStat[];
  topResources: { id: string; title: string; type: string; ordersCount: number }[];
  topWebinars: { id: string; title: string; registrationsCount: number; attendedCount: number }[];
  referrals: { referralCode: string; userCount: number; enrollmentsCount: number }[];
  providers: MarketingDistributionItem[];
};

export async function getAdminMarketingAnalytics(): Promise<MarketingAnalyticsPayload> {
  return withDashboardCache("admin:marketing:analytics", computeAdminMarketingAnalytics);
}

async function computeAdminMarketingAnalytics(): Promise<MarketingAnalyticsPayload> {
  const [
    userStatsRes,
    govRes,
    personaRes,
    eduRes,
    coursesRes,
    resourcesRes,
    webinarsRes,
    referralsRes,
    providersRes,
  ] = await Promise.all([
    db.execute<{
      total_registered: number;
      active_30d: number;
      dormant_users: number;
      phone_provided: number;
      phone_verified: number;
      email_verified: number;
      onboarding_completed: number;
    }>(sql`
      select
        (select count(*)::int from "user") as total_registered,
        (select count(distinct user_id)::int from session where updated_at >= now() - interval '30 days') as active_30d,
        (select count(*)::int from "user" u where not exists (
          select 1 from session s where s.user_id = u.id and s.updated_at >= now() - interval '30 days'
        )) as dormant_users,
        (select count(*)::int from user_profile where phone_number is not null and trim(phone_number) != '') as phone_provided,
        (select count(*)::int from user_profile where phone_verified_at is not null) as phone_verified,
        (select count(*)::int from "user" where email_verified = true) as email_verified,
        (select count(*)::int from user_profile where onboarding_completed_at is not null) as onboarding_completed
    `),

    db.execute<{ governorate: string; count: number }>(sql`
      select
        coalesce(nullif(initcap(trim(governorate)), ''), 'Non renseigné') as governorate,
        count(*)::int as count
      from user_profile
      group by 1
      order by count desc, governorate
    `),

    db.execute<{ persona: string; count: number }>(sql`
      with resolved as (
        select
          u.id,
          coalesce(pm.persona, up.requested_persona, 'STUDENT') as persona
        from "user" u
        left join (
          select distinct on (user_id) user_id, persona
          from persona_membership
          order by user_id, is_primary desc, created_at desc
        ) pm on pm.user_id = u.id
        left join user_profile up on up.user_id = u.id
      )
      select persona, count(*)::int as count
      from resolved
      group by persona
      order by count desc
    `),

    db.execute<{ education_level: string; count: number }>(sql`
      select
        coalesce(nullif(upper(trim(education_level)), ''), 'NON RENSEIGNÉ') as education_level,
        count(*)::int as count
      from user_profile
      group by 1
      order by count desc
    `),

    db.execute<{
      id: string;
      title: string;
      enrollments: number;
      completed: number;
      avg_progress: number;
      drop_offs: number;
      completion_rate: number;
    }>(sql`
      select
        c.id,
        c.title_fr as title,
        count(e.id)::int as enrollments,
        count(e.id) filter (where e.status = 'completed')::int as completed,
        round(coalesce(avg(e.progress_percent), 0))::int as avg_progress,
        count(e.id) filter (where e.progress_percent < 20 and e.status = 'active')::int as drop_offs,
        round(coalesce(count(e.id) filter (where e.status = 'completed')::numeric / nullif(count(e.id), 0) * 100, 0))::int as completion_rate
      from courses c
      left join enrollments e on e.course_id = c.id
      where c.published = true
      group by c.id, c.title_fr
      order by enrollments desc, completion_rate desc
      limit 12
    `),

    db.execute<{ id: string; title: string; type: string; orders_count: number }>(sql`
      select
        r.id,
        r.title_fr as title,
        r.type,
        count(o.id)::int as orders_count
      from resources r
      left join orders o on o.item_id = r.id and o.item_type = 'resource' and o.status = 'paid'
      where r.published = true
      group by r.id, r.title_fr, r.type
      order by orders_count desc, r.title_fr
      limit 6
    `),

    db.execute<{ id: string; title: string; registrations_count: number; attended_count: number }>(sql`
      select
        w.id,
        w.title_fr as title,
        count(wr.id)::int as registrations_count,
        count(wr.id) filter (where wr.status in ('ATTENDED', 'ACCEPTED'))::int as attended_count
      from webinars w
      left join webinar_registrations wr on wr.webinar_id = w.id
      where w.published = true
      group by w.id, w.title_fr
      order by registrations_count desc, w.title_fr
      limit 6
    `),

    db.execute<{ referral_code: string; user_count: number; enrollments_count: number }>(sql`
      select
        coalesce(nullif(trim(u.referred_by_code), ''), 'DIRECT') as referral_code,
        count(distinct u.id)::int as user_count,
        count(distinct e.id)::int as enrollments_count
      from "user" u
      left join enrollments e on e.user_id = u.id
      group by 1
      order by user_count desc
      limit 8
    `),

    db.execute<{ provider: string; count: number }>(sql`
      with prov as (
        select user_id,
          case when bool_or(provider_id = 'google') then 'Google' else 'Email' end as provider
        from account
        group by user_id
      )
      select provider, count(*)::int as count
      from prov
      group by provider
      order by count desc
    `),
  ]);

  const userStats = userStatsRes.rows[0];
  const totalRegistered = userStats?.total_registered ?? 0;
  const activeLast30d = userStats?.active_30d ?? 0;
  const dormantUsers = userStats?.dormant_users ?? 0;
  const retentionRatePercent = totalRegistered > 0 ? Math.round((activeLast30d / totalRegistered) * 1000) / 10 : 0;

  const totalGov = govRes.rows.reduce((sum, r) => sum + r.count, 0);
  const governorates: MarketingDistributionItem[] = govRes.rows.map((r) => ({
    label: r.governorate,
    count: r.count,
    percentage: totalGov > 0 ? Math.round((r.count / totalGov) * 100) : 0,
  }));

  const totalPersonas = personaRes.rows.reduce((sum, r) => sum + r.count, 0);
  const personas: MarketingDistributionItem[] = personaRes.rows.map((r) => ({
    label: r.persona,
    count: r.count,
    percentage: totalPersonas > 0 ? Math.round((r.count / totalPersonas) * 100) : 0,
  }));

  const totalEdu = eduRes.rows.reduce((sum, r) => sum + r.count, 0);
  const educationLevels: MarketingDistributionItem[] = eduRes.rows.map((r) => ({
    label: r.education_level,
    count: r.count,
    percentage: totalEdu > 0 ? Math.round((r.count / totalEdu) * 100) : 0,
  }));

  const totalProviders = providersRes.rows.reduce((sum, r) => sum + r.count, 0);
  const providers: MarketingDistributionItem[] = providersRes.rows.map((r) => ({
    label: r.provider,
    count: r.count,
    percentage: totalProviders > 0 ? Math.round((r.count / totalProviders) * 100) : 0,
  }));

  const allCourses = coursesRes.rows.map((r) => ({
    id: r.id,
    title: r.title,
    enrollments: r.enrollments,
    completed: r.completed,
    avgProgress: r.avg_progress,
    dropOffs: r.drop_offs,
    completionRate: r.completion_rate,
  }));

  const topCourses = allCourses.slice(0, 6);
  const strugglingCourses = allCourses
    .filter((c) => c.enrollments > 0 && (c.completionRate <= 35 || c.dropOffs > 0))
    .sort((a, b) => b.dropOffs - a.dropOffs || a.completionRate - b.completionRate)
    .slice(0, 6);

  return {
    stats: {
      totalRegistered,
      activeLast30d,
      dormantUsers,
      phoneProvidedCount: userStats?.phone_provided ?? 0,
      phoneVerifiedCount: userStats?.phone_verified ?? 0,
      emailVerifiedCount: userStats?.email_verified ?? 0,
      onboardingCompletedCount: userStats?.onboarding_completed ?? 0,
      retentionRatePercent,
    },
    governorates,
    personas,
    educationLevels,
    topCourses,
    strugglingCourses,
    topResources: resourcesRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      ordersCount: r.orders_count,
    })),
    topWebinars: webinarsRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      registrationsCount: r.registrations_count,
      attendedCount: r.attended_count,
    })),
    referrals: referralsRes.rows.map((r) => ({
      referralCode: r.referral_code,
      userCount: r.user_count,
      enrollmentsCount: r.enrollments_count,
    })),
    providers,
  };
}

export type MarketingAudienceRow = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  governorate: string;
  city: string | null;
  persona: string;
  educationLevel: string;
  enrollmentsCount: number;
  certsCount: number;
  referredByCode: string | null;
  joinedAt: Date;
  lastActive: Date | null;
  status: "ACTIVE" | "DORMANT";
  totalCount: number;
};

export interface MarketingAudienceFilters {
  q?: string;
  governorate?: string;
  persona?: string;
  status?: string;
  hasPhone?: string;
  page?: number;
  pageSize?: number;
}

export async function getMarketingAudienceDirectory(input: MarketingAudienceFilters = {}) {
  const page = Number.isSafeInteger(input.page) && (input.page ?? 0) > 0 ? input.page! : 1;
  const pageSize = [10, 25, 50, 100].includes(input.pageSize ?? 25) ? input.pageSize! : 25;
  const offset = (page - 1) * pageSize;
  const search = input.q?.trim() ? `%${input.q.trim().slice(0, 100)}%` : null;
  const govFilter = input.governorate?.trim() ? input.governorate.trim() : null;
  const personaFilter = input.persona?.trim() ? input.persona.trim() : null;
  const statusFilter = input.status === "active" || input.status === "dormant" ? input.status : null;
  const hasPhoneFilter = input.hasPhone === "yes" || input.hasPhone === "no" ? input.hasPhone : null;

  const result = await db.execute<{
    id: string;
    name: string;
    email: string;
    phone_number: string | null;
    phone_verified: boolean;
    email_verified: boolean;
    governorate: string;
    city: string | null;
    persona: string;
    education_level: string;
    enrollments_count: number;
    certs_count: number;
    referred_by_code: string | null;
    joined_at: Date;
    last_active: Date | null;
    status: "ACTIVE" | "DORMANT";
    total_count: number;
  }>(sql`
    with user_leads as (
      select
        u.id,
        u.name,
        u.email,
        u.email_verified,
        u.referred_by_code,
        u.created_at as joined_at,
        p.phone_number,
        (p.phone_verified_at is not null) as phone_verified,
        coalesce(nullif(initcap(trim(p.governorate)), ''), 'Non renseigné') as governorate,
        p.city,
        coalesce(pm.persona, p.requested_persona, 'STUDENT') as persona,
        coalesce(nullif(upper(trim(p.education_level)), ''), 'NON RENSEIGNÉ') as education_level,
        coalesce(e.enrollments_count, 0)::int as enrollments_count,
        coalesce(c.certs_count, 0)::int as certs_count,
        s.last_active,
        case when s.last_active >= now() - interval '30 days' then 'ACTIVE' else 'DORMANT' end as status
      from "user" u
      left join user_profile p on p.user_id = u.id
      left join (
        select distinct on (user_id) user_id, persona
        from persona_membership
        order by user_id, is_primary desc, created_at desc
      ) pm on pm.user_id = u.id
      left join (
        select user_id, count(*)::int as enrollments_count
        from enrollments
        group by user_id
      ) e on e.user_id = u.id
      left join (
        select user_id, count(*)::int as certs_count
        from certificates
        group by user_id
      ) c on c.user_id = u.id
      left join (
        select user_id, max(updated_at) as last_active
        from session
        group by user_id
      ) s on s.user_id = u.id
    )
    select
      id, name, email, phone_number, phone_verified, email_verified,
      governorate, city, persona, education_level,
      enrollments_count, certs_count, referred_by_code,
      joined_at, last_active, status,
      count(*) over()::int as total_count
    from user_leads
    where (${search}::text is null or name ilike ${search} or email ilike ${search} or phone_number ilike ${search} or referred_by_code ilike ${search})
      and (${govFilter}::text is null or governorate ilike ${govFilter})
      and (${personaFilter}::text is null or persona = ${personaFilter})
      and (${statusFilter}::text is null or
        (${statusFilter} = 'active' and status = 'ACTIVE') or
        (${statusFilter} = 'dormant' and status = 'DORMANT'))
      and (${hasPhoneFilter}::text is null or
        (${hasPhoneFilter} = 'yes' and phone_number is not null and trim(phone_number) != '') or
        (${hasPhoneFilter} = 'no' and (phone_number is null or trim(phone_number) = '')))
    order by joined_at desc
    limit ${pageSize} offset ${offset}
  `);

  const total = result.rows[0]?.total_count ?? 0;
  const items: MarketingAudienceRow[] = result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phoneNumber: r.phone_number,
    phoneVerified: Boolean(r.phone_verified),
    emailVerified: Boolean(r.email_verified),
    governorate: r.governorate,
    city: r.city,
    persona: r.persona,
    educationLevel: r.education_level,
    enrollmentsCount: r.enrollments_count,
    certsCount: r.certs_count,
    referredByCode: r.referred_by_code,
    joinedAt: new Date(r.joined_at),
    lastActive: r.last_active ? new Date(r.last_active) : null,
    status: r.status,
    totalCount: total,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: {
      q: input.q?.trim().slice(0, 100),
      governorate: govFilter,
      persona: personaFilter,
      status: statusFilter,
      hasPhone: hasPhoneFilter,
      page,
      pageSize,
    },
  };
}

export async function getMarketingAudienceForExport(limit = 5000): Promise<MarketingAudienceRow[]> {
  const result = await db.execute<{
    id: string;
    name: string;
    email: string;
    phone_number: string | null;
    phone_verified: boolean;
    email_verified: boolean;
    governorate: string;
    city: string | null;
    persona: string;
    education_level: string;
    enrollments_count: number;
    certs_count: number;
    referred_by_code: string | null;
    joined_at: Date;
    last_active: Date | null;
    status: "ACTIVE" | "DORMANT";
    total_count: number;
  }>(sql`
    with user_leads as (
      select
        u.id,
        u.name,
        u.email,
        u.email_verified,
        u.referred_by_code,
        u.created_at as joined_at,
        p.phone_number,
        (p.phone_verified_at is not null) as phone_verified,
        coalesce(nullif(initcap(trim(p.governorate)), ''), 'Non renseigné') as governorate,
        p.city,
        coalesce(pm.persona, p.requested_persona, 'STUDENT') as persona,
        coalesce(nullif(upper(trim(p.education_level)), ''), 'NON RENSEIGNÉ') as education_level,
        coalesce(e.enrollments_count, 0)::int as enrollments_count,
        coalesce(c.certs_count, 0)::int as certs_count,
        s.last_active,
        case when s.last_active >= now() - interval '30 days' then 'ACTIVE' else 'DORMANT' end as status
      from "user" u
      left join user_profile p on p.user_id = u.id
      left join (
        select distinct on (user_id) user_id, persona
        from persona_membership
        order by user_id, is_primary desc, created_at desc
      ) pm on pm.user_id = u.id
      left join (
        select user_id, count(*)::int as enrollments_count
        from enrollments
        group by user_id
      ) e on e.user_id = u.id
      left join (
        select user_id, count(*)::int as certs_count
        from certificates
        group by user_id
      ) c on c.user_id = u.id
      left join (
        select user_id, max(updated_at) as last_active
        from session
        group by user_id
      ) s on s.user_id = u.id
    )
    select
      id, name, email, phone_number, phone_verified, email_verified,
      governorate, city, persona, education_level,
      enrollments_count, certs_count, referred_by_code,
      joined_at, last_active, status,
      count(*) over()::int as total_count
    from user_leads
    order by joined_at desc
    limit ${limit}
  `);

  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phoneNumber: r.phone_number,
    phoneVerified: Boolean(r.phone_verified),
    emailVerified: Boolean(r.email_verified),
    governorate: r.governorate,
    city: r.city,
    persona: r.persona,
    educationLevel: r.education_level,
    enrollmentsCount: r.enrollments_count,
    certsCount: r.certs_count,
    referredByCode: r.referred_by_code,
    joinedAt: new Date(r.joined_at),
    lastActive: r.last_active ? new Date(r.last_active) : null,
    status: r.status,
    totalCount: result.rows.length,
  }));
}

