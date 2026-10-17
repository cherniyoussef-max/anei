import "server-only";
import { getRedis } from "@/server/cache/redis";
import { logger } from "@/server/security/logger";

const inFlightPromises = new Map<string, Promise<unknown>>();

export interface CacheOptions {
  /** Jitter fraction applied to TTL to prevent synchronized cache stampedes (default: 0.15 = +/- 15%) */
  jitterRatio?: number;
  /** Skip cache read and force re-fetching */
  forceFresh?: boolean;
}

/**
 * Calculates a jittered TTL to protect against cache stampedes / thundering herds.
 */
export function calculateJitteredTtl(baseTtlSeconds: number, jitterRatio = 0.15): number {
  if (baseTtlSeconds <= 1) return baseTtlSeconds;
  const variation = Math.floor(baseTtlSeconds * jitterRatio);
  const randomOffset = Math.floor(Math.random() * (variation * 2 + 1)) - variation;
  return Math.max(1, baseTtlSeconds + randomOffset);
}

/**
 * High-performance Redis cache with in-process single-flight coalescing
 * and jittered expiration to eliminate cache stampedes.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  options?: CacheOptions,
): Promise<T> {
  const forceFresh = options?.forceFresh ?? false;

  // 1. Check Redis if not forcing fresh
  if (!forceFresh) {
    try {
      const client = await getRedis();
      if (client?.isOpen) {
        const cached = await client.get(key);
        if (cached !== null) {
          try {
            return JSON.parse(cached) as T;
          } catch {
            // Corrupt payload; proceed to refetch
          }
        }
      }
    } catch (err) {
      logger.warn("cache.redis_read_failed", { key, error: String(err) });
    }
  }

  // 2. Single-flight coalescing: ensure only 1 concurrent fetcher per key
  const existingInFlight = inFlightPromises.get(key);
  if (existingInFlight) {
    return (await existingInFlight) as T;
  }

  const executionPromise = (async () => {
    try {
      const data = await fetcher();

      // Store in Redis with jitter
      try {
        const client = await getRedis();
        if (client?.isOpen && data !== undefined) {
          const jitteredTtl = calculateJitteredTtl(ttlSeconds, options?.jitterRatio ?? 0.15);
          await client.set(key, JSON.stringify(data), { EX: jitteredTtl });
        }
      } catch (writeErr) {
        logger.warn("cache.redis_write_failed", { key, error: String(writeErr) });
      }

      return data;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, executionPromise);
  return (await executionPromise) as T;
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCacheKey(key: string): Promise<void> {
  inFlightPromises.delete(key);
  try {
    const client = await getRedis();
    if (client?.isOpen) {
      await client.del(key);
    }
  } catch (err) {
    logger.warn("cache.redis_del_failed", { key, error: String(err) });
  }
}
