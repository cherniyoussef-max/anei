import "server-only";
import { getRedis } from "@/server/cache/redis";
import { logger } from "@/server/security/logger";

const LIST_PATTERN = "admin:users:list:*";
const detailKey = (userId: string) => `admin:users:detail:${userId}`;

/**
 * Best-effort invalidation for src/modules/admin/queries/admin-users.ts's 60s
 * caches. List entries are keyed by their full filter set (unbounded key
 * space), so there's no exact key to delete — SCAN (not KEYS, which blocks
 * Redis) finds and unlinks them without a new dependency. Never throws: a
 * Redis outage must not roll back or fail an already-committed DB mutation,
 * it only means list/detail data stays stale for up to the existing 60s TTL.
 */
export async function invalidateAdminUserCaches(userId: string) {
  try {
    const redis = await getRedis();
    if (!redis) return;

    const listKeys: string[] = [];
    for await (const batch of redis.scanIterator({ MATCH: LIST_PATTERN, COUNT: 100 })) {
      listKeys.push(...batch);
    }

    await Promise.all([redis.unlink(detailKey(userId)), listKeys.length > 0 ? redis.unlink(listKeys) : Promise.resolve()]);
  } catch (error) {
    logger.error("admin.user_cache_invalidation_failed", { userId, error: String(error) });
  }
}
