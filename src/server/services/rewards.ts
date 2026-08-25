import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { rewardItem, rewardRedemption } from "@/server/db/schema";
import { grantPoints } from "@/server/services/points";

type RedeemResult =
  | { kind: "ok"; redemptionId: string }
  | { kind: "not_found" }
  | { kind: "insufficient_points" }
  | { kind: "out_of_stock" };

/**
 * Redeems a published reward item for the given user. Runs under an
 * advisory lock scoped to the user so two concurrent redemption requests
 * can never both pass the balance check against the same starting balance
 * (classic check-then-act race) — mirrors the pg_advisory_xact_lock idiom
 * already used for assessment publication/attempt-start.
 */
export async function redeemReward(userId: string, rewardItemId: string): Promise<RedeemResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [item] = await tx.select().from(rewardItem).where(and(eq(rewardItem.id, rewardItemId), eq(rewardItem.published, true))).limit(1);
    if (!item) return { kind: "not_found" as const };
    if (item.stock !== null && item.stock <= 0) return { kind: "out_of_stock" as const };

    const balanceResult = await tx.execute<{ total: number }>(sql`select coalesce(sum(delta), 0)::int as total from points_ledger where user_id = ${userId}`);
    const total = balanceResult.rows[0]?.total ?? 0;
    if (total < item.costPoints) return { kind: "insufficient_points" as const };

    const [redemption] = await tx.insert(rewardRedemption).values({ userId, rewardItemId, costPoints: item.costPoints }).returning({ id: rewardRedemption.id });
    await grantPoints(tx, { userId, reason: "REWARD_REDEMPTION", delta: -item.costPoints, referenceType: "reward_redemption", referenceId: redemption.id });
    if (item.stock !== null) await tx.update(rewardItem).set({ stock: item.stock - 1, updatedAt: new Date() }).where(eq(rewardItem.id, item.id));

    return { kind: "ok" as const, redemptionId: redemption.id };
  });
}
