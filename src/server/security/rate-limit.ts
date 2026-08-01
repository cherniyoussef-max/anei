import "server-only";
import crypto from "node:crypto";
import { getRedis } from "@/server/cache/redis";
import { env } from "@/server/env";

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();
const REDIS_CONSUME_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { count, ttl }
`;

function memoryConsume(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowSeconds * 1000 };
    memoryBuckets.set(key, bucket);
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: windowSeconds };
  }
  current.count += 1;
  if (memoryBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of memoryBuckets) if (bucket.resetAt <= now) memoryBuckets.delete(bucketKey);
  }
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    const client = await getRedis();
    if (!client) return memoryConsume(key, limit, windowSeconds);
    const redisKey = `anei:rl:${key}`;
    const result = await client.sendCommand([
      "EVAL",
      REDIS_CONSUME_SCRIPT,
      "1",
      redisKey,
      String(windowSeconds),
    ]);
    if (!Array.isArray(result)) throw new Error("Unexpected Redis rate-limit response");
    const [count, ttl] = result.map(Number);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch {
    return memoryConsume(key, limit, windowSeconds);
  }
}

export function requestFingerprint(request: Request) {
  const forwarded = env.TRUST_PROXY_HEADERS ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  const realIp = env.TRUST_PROXY_HEADERS ? request.headers.get("x-real-ip") ?? undefined : undefined;
  const userAgent = request.headers.get("user-agent") ?? "unknown-agent";
  const ip = forwarded || realIp || "direct-client";
  return crypto.createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 24);
}
