import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";

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
};

export async function getAdminUsers(input: AdminUserFilters = {}) {
  const filter = normalize(input);
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
  return { items: result.rows, total, page: filter.page, pageSize: filter.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)), filters: filter };
}

type DetailRow = UserListRow & { profile_type: string; locale: string; email_verified: boolean; certificates: number; webinars: number; paid_millimes: number };
export async function getAdminUserDetail(id: string) {
  const result = await db.execute<DetailRow>(sql`
    select u.id,u.name,u.email,u.image,u.role,u.created_at joined_at,u.profile_type,u.locale,u.email_verified,
      coalesce((select case when bool_or(provider_id='google') then 'google' else 'credential' end from account where user_id=u.id),'credential') provider,
      (select max(updated_at) from session where user_id=u.id) last_activity,
      (select count(*)::int from enrollments where user_id=u.id) enrollments,
      coalesce((select round(avg(progress_percent))::int from enrollments where user_id=u.id),0) completion,
      (select count(*)::int from certificates where user_id=u.id) certificates,
      (select count(*)::int from webinar_registrations where user_id=u.id) webinars,
      coalesce((select sum(amount_millimes)::int from orders where user_id=u.id and status='paid'),0) paid_millimes,
      1::int total_count
    from "user" u where u.id=${id} limit 1
  `);
  if (!result.rows[0]) return null;
  const [enrollments, sessions, certificates, videoProgress] = await Promise.all([
    db.execute(sql`select e.id,e.status,e.progress_percent,e.enrolled_at,e.completed_at,c.id course_id,c.title_fr,c.title_ar from enrollments e join courses c on c.id=e.course_id where e.user_id=${id} order by e.enrolled_at desc limit 100`),
    db.execute(sql`select id,created_at,updated_at,expires_at,ip_address,user_agent from session where user_id=${id} order by updated_at desc limit 50`),
    db.execute(sql`select c.id,c.code,c.issued_at,co.title_fr,co.title_ar from certificates c join courses co on co.id=c.course_id where c.user_id=${id} order by c.issued_at desc limit 100`),
    db.execute(sql`select lp.id, lp.watched_seconds, lp.completed, lp.updated_at, l.title_fr, l.title_ar, coalesce(l.duration_seconds, 0) as duration_seconds, c.title_fr as course_fr, c.title_ar as course_ar from lesson_progress lp join lessons l on l.id = lp.lesson_id join enrollments e on e.id = lp.enrollment_id join courses c on c.id = l.course_id where e.user_id=${id} order by lp.updated_at desc limit 100`),
  ]);
  return { user: result.rows[0], enrollments: enrollments.rows, sessions: sessions.rows, certificates: certificates.rows, videoProgress: videoProgress.rows };
}
