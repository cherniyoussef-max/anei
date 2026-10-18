import "server-only";
import { createClient } from "redis";
import { env } from "@/server/env";

function isLoopback(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function createRedisClient(url: string) {
  return createClient({
    url,
    socket: {
      connectTimeout: 400,
      reconnectStrategy: false,
    },
  });
}

type RedisClient = ReturnType<typeof createRedisClient>;
type RedisGlobal = typeof globalThis & {
  __aneiRedis?: RedisClient | null;
  __aneiRedisConnect?: Promise<RedisClient | null>;
  __aneiRedisFailedUntil?: number;
};

const shared = globalThis as RedisGlobal;

function buildClient(): RedisClient | null {
  if (!env.REDIS_URL) return null;
  if ((process.env.VERCEL === "1" || env.NODE_ENV === "production") && isLoopback(env.REDIS_URL)) {
    return null;
  }
  try {
    const client = createRedisClient(env.REDIS_URL);
    client.on("error", (error) => {
      if (env.NODE_ENV !== "test") console.warn("[redis]", error instanceof Error ? error.message : error);
    });
    return client;
  } catch {
    return null;
  }
}

export const redis: RedisClient | null = env.REDIS_URL
  ? (shared.__aneiRedis !== undefined ? shared.__aneiRedis : (shared.__aneiRedis = buildClient()))
  : null;

export async function getRedis(): Promise<RedisClient | null> {
  if (!redis) return null;
  if (shared.__aneiRedisFailedUntil && Date.now() < shared.__aneiRedisFailedUntil) {
    return null;
  }
  if (redis.isOpen) return redis;

  try {
    shared.__aneiRedisConnect ??= Promise.race([
      redis.connect().then(() => redis),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Redis connect timeout (400ms)")), 400),
      ),
    ]);
    const client = await shared.__aneiRedisConnect;
    return client;
  } catch {
    shared.__aneiRedisFailedUntil = Date.now() + 60_000;
    shared.__aneiRedisConnect = undefined;
    return null;
  }
}

export async function checkRedis() {
  if (!redis) return { configured: false, available: false };
  try {
    const client = await getRedis();
    const pong = await client?.ping();
    return { configured: true, available: pong === "PONG" };
  } catch {
    return { configured: true, available: false };
  }
}
