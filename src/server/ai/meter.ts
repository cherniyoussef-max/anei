import "server-only";
import crypto from "node:crypto";
import { getRedis } from "@/server/cache/redis";
import { db } from "@/server/db";
import { aiUsageLog } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

export type BotAudience = "PUBLIC" | "TEACHER";

export interface QuotaCheckInput {
  audience: BotAudience;
  userId?: string | null;
  ip?: string;
  userAgent?: string;
  estimatedTokens?: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  remainingRequests?: number;
}

// Limits per bot persona
export const AI_QUOTA_LIMITS = {
  PUBLIC_GUEST: {
    maxRequestsPerMinute: 10,
    windowSeconds: 60,
    maxTokensPerHour: 15_000,
  },
  PUBLIC_AUTHENTICATED: {
    maxRequestsPerMinute: 20,
    windowSeconds: 60,
    maxTokensPerDay: 150_000,
  },
  TEACHER: {
    maxRequestsPerMinute: 30,
    windowSeconds: 60,
    maxTokensPerDay: 500_000,
  },
} as const;

// In-memory sliding window fallback for outages / test environments
interface MemoryWindowBucket {
  timestamps: number[];
  tokenCount: number;
  resetAt: number;
}
const memoryQuotaBuckets = new Map<string, MemoryWindowBucket>();

function computeSubnetFingerprint(ip?: string, userAgent?: string): string {
  const cleanIp = (ip || "127.0.0.1").trim();
  // Anonymize/group by /24 for IPv4 or /48 for IPv6
  let subnet = cleanIp;
  if (cleanIp.includes(".")) {
    const parts = cleanIp.split(".");
    if (parts.length === 4) {
      subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
  } else if (cleanIp.includes(":")) {
    const parts = cleanIp.split(":");
    subnet = `${parts.slice(0, 3).join(":")}::/48`;
  }
  const ua = (userAgent || "unknown-ua").slice(0, 64);
  return crypto.createHash("sha256").update(`${subnet}|${ua}`).digest("hex").slice(0, 16);
}

/**
 * Sliding window rate-limiting script for Redis 7.
 * Uses a Redis Sorted Set (ZSET) where score = timestamp in ms.
 * KEYS[1]: rate limit zset key
 * ARGV[1]: current timestamp ms
 * ARGV[2]: window size in ms
 * ARGV[3]: max allowed requests
 * Returns: { allowed (1 or 0), remaining, retryAfterSeconds }
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

-- Remove timestamps outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

-- Count current items in window
local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
  redis.call('ZADD', key, now, now .. '-' .. math.random(1000, 9999))
  redis.call('PEXPIRE', key, window + 1000)
  return { 1, limit - (currentCount + 1), 0 }
else
  -- Fetch the oldest item in the window to calculate retryAfter
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTime = tonumber(oldest[2]) or clearBefore
  local retryAfterMs = (oldestTime + window) - now
  local retryAfterSec = math.max(1, math.ceil(retryAfterMs / 1000))
  return { 0, 0, retryAfterSec }
end
`;

/**
 * Validates request frequency and token quotas to protect against model drain.
 */
export async function checkAndConsumeAiQuota(input: QuotaCheckInput): Promise<QuotaCheckResult> {
  const { audience, userId, ip, userAgent, estimatedTokens = 500 } = input;
  const now = Date.now();

  let limitConfig: { maxRequestsPerMinute: number; windowSeconds: number };
  let identifier: string;

  if (audience === "TEACHER") {
    if (!userId) {
      return { allowed: false, reason: "Authentication required for Teacher Assistant" };
    }
    limitConfig = AI_QUOTA_LIMITS.TEACHER;
    identifier = `teacher:user:${userId}`;
  } else if (userId) {
    limitConfig = AI_QUOTA_LIMITS.PUBLIC_AUTHENTICATED;
    identifier = `public:user:${userId}`;
  } else {
    limitConfig = AI_QUOTA_LIMITS.PUBLIC_GUEST;
    const fingerprint = computeSubnetFingerprint(ip, userAgent);
    identifier = `public:guest:${fingerprint}`;
  }

  // 1. Check with Redis
  try {
    const client = await getRedis();
    if (client?.isOpen) {
      const zsetKey = `anei:ai:quota:${identifier}`;
      const windowMs = limitConfig.windowSeconds * 1000;

      const result = await client.sendCommand([
        "EVAL",
        SLIDING_WINDOW_LUA,
        "1",
        zsetKey,
        String(now),
        String(windowMs),
        String(limitConfig.maxRequestsPerMinute),
      ]);

      if (Array.isArray(result)) {
        const [allowedNum, remainingNum, retryAfterSec] = result.map(Number);
        if (allowedNum === 0) {
          logger.warn("ai.quota_exceeded_redis", { identifier, retryAfterSec });
          return {
            allowed: false,
            reason: `Rate limit reached. Please wait ${retryAfterSec}s before sending another prompt.`,
            retryAfterSeconds: retryAfterSec,
            remainingRequests: 0,
          };
        }

        return {
          allowed: true,
          remainingRequests: remainingNum,
        };
      }
    }
  } catch (err) {
    logger.warn("ai.quota_redis_outage_fallback", { identifier, error: String(err) });
  }

  // 2. Fallback to in-memory sliding window
  const bucketKey = identifier;
  let bucket = memoryQuotaBuckets.get(bucketKey);
  const windowMs = limitConfig.windowSeconds * 1000;
  const cutoff = now - windowMs;

  if (!bucket || bucket.resetAt <= now) {
    bucket = { timestamps: [now], tokenCount: estimatedTokens, resetAt: now + windowMs };
    memoryQuotaBuckets.set(bucketKey, bucket);
    return { allowed: true, remainingRequests: limitConfig.maxRequestsPerMinute - 1 };
  }

  // Filter timestamps
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= limitConfig.maxRequestsPerMinute) {
    const oldest = bucket.timestamps[0] || cutoff;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    logger.warn("ai.quota_exceeded_memory", { identifier, retryAfterSec });
    return {
      allowed: false,
      reason: `Rate limit reached. Please wait ${retryAfterSec}s before sending another prompt.`,
      retryAfterSeconds: retryAfterSec,
      remainingRequests: 0,
    };
  }

  bucket.timestamps.push(now);
  bucket.tokenCount += estimatedTokens;

  // Cleanup map size if it exceeds threshold
  if (memoryQuotaBuckets.size > 5_000) {
    for (const [k, b] of memoryQuotaBuckets) {
      if (b.resetAt <= now) memoryQuotaBuckets.delete(k);
    }
  }

  return {
    allowed: true,
    remainingRequests: limitConfig.maxRequestsPerMinute - bucket.timestamps.length,
  };
}

/**
 * Record usage in DB asynchronously without blocking response stream.
 */
export async function recordAiUsageLog(params: {
  userId?: string | null;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  success: boolean;
}): Promise<void> {
  try {
    if (params.userId) {
      await db.insert(aiUsageLog).values({
        userId: params.userId,
        provider: params.provider,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        durationMs: params.durationMs,
        success: params.success,
      });
    }
  } catch (err) {
    logger.warn("ai.usage_log_failed", { error: String(err) });
  }
}
