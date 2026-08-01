import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

type MetricRow = { total: number; secondary: number; tertiary: number; amount: number };
export async function getLearningOperations() {
  const result = await db.execute<MetricRow>(sql`select
    count(*)::int total,
    count(*) filter(where status='completed')::int secondary,
    coalesce(round(avg(progress_percent)),0)::int tertiary,
    0::int amount from enrollments`);
  return result.rows[0] ?? { total:0,secondary:0,tertiary:0,amount:0 };
}
export async function getCourseOperations() {
  const result = await db.execute<MetricRow>(sql`select
    count(*)::int total, count(*) filter(where published)::int secondary,
    (select count(*)::int from enrollments)::int tertiary,
    (select count(*)::int from certificates)::int amount from courses`);
  return result.rows[0] ?? { total:0,secondary:0,tertiary:0,amount:0 };
}
export async function getCommerceOperations() {
  const result = await db.execute<MetricRow>(sql`select
    count(*)::int total, count(*) filter(where status='paid')::int secondary,
    count(*) filter(where status='pending')::int tertiary,
    coalesce(sum(amount_millimes) filter(where status='paid'),0)::int amount from orders`);
  return result.rows[0] ?? { total:0,secondary:0,tertiary:0,amount:0 };
}
export async function getContentCounts() {
  const result = await db.execute<{ courses:number; webinars:number; resources:number; news:number; contacts:number; certificates:number }>(sql`select
    (select count(*)::int from courses) courses,(select count(*)::int from webinars) webinars,
    (select count(*)::int from resources) resources,(select count(*)::int from news_posts) news,
    (select count(*)::int from contact_messages) contacts,(select count(*)::int from certificates) certificates`);
  return result.rows[0] ?? {courses:0,webinars:0,resources:0,news:0,contacts:0,certificates:0};
}
