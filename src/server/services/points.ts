import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { pointsLedger, user } from "@/server/db/schema";

/** Virtual points only — no real currency, no payment-system interaction. Tune freely; changing a value here has no schema/migration impact. */
export const POINT_VALUES = {
  LESSON_COMPLETE: 5,
  COURSE_COMPLETE: 50,
  QUIZ_PASSED: 20,
  REFERRAL_BONUS: 100,
} as const;

type PointsReason = "LESSON_COMPLETE" | "COURSE_COMPLETE" | "QUIZ_PASSED" | "REFERRAL_BONUS" | "REWARD_REDEMPTION" | "ADMIN_ADJUSTMENT";
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Inserts one ledger row. MUST be called with the caller's own in-flight
 * transaction. Idempotent when `referenceId` is provided: a retried/duplicate
 * grant for the same (userId, reason, referenceId) is a safe no-op, enforced
 * by the DB partial unique index (see schema.ts's points_ledger comment) —
 * never a duplicate award.
 */
export async function grantPoints(tx: DbClient, input: { userId: string; reason: PointsReason; delta: number; referenceType?: string; referenceId?: string }) {
  await tx.insert(pointsLedger).values({
    userId: input.userId,
    reason: input.reason,
    delta: input.delta,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
  }).onConflictDoNothing();
}

export async function getPointsBalance(userId: string): Promise<number> {
  const [row] = await db.select({ total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int` }).from(pointsLedger).where(eq(pointsLedger.userId, userId));
  return row?.total ?? 0;
}

export async function getPointsLedgerPage(userId: string, page = 1, pageSize = 25) {
  const safePage = Math.max(1, page);
  const rows = await db.select().from(pointsLedger).where(eq(pointsLedger.userId, userId)).orderBy(desc(pointsLedger.createdAt)).limit(pageSize).offset((safePage - 1) * pageSize);
  return rows;
}

/** First name + last-initial only — never exposes email/full identity on a public-ish leaderboard. */
export async function getLeaderboard(limit = 50) {
  const rows = await db.select({
    userId: pointsLedger.userId,
    name: user.name,
    total: sql<number>`sum(${pointsLedger.delta})::int`,
  }).from(pointsLedger)
    .innerJoin(user, eq(pointsLedger.userId, user.id))
    .groupBy(pointsLedger.userId, user.name)
    .orderBy(desc(sql`sum(${pointsLedger.delta})`))
    .limit(Math.min(100, Math.max(1, limit)));
  return rows.map((row) => ({
    userId: row.userId,
    total: row.total,
    displayName: maskName(row.name),
  }));
}

function maskName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? name;
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}
