import "server-only";
import { createClient } from "redis";
import { env } from "@/server/env";

function createRedisClient(url: string) {
  return createClient({ url });
}

type RedisClient = ReturnType<typeof createRedisClient>;
type RedisGlobal = typeof globalThis & {
  __aneiRedis?: RedisClient;
  __aneiRedisConnect?: Promise<RedisClient>;
};

const shared = globalThis as RedisGlobal;

function buildClient(): RedisClient | null {
  if (!env.REDIS_URL) return null;
  const client = createRedisClient(env.REDIS_URL);
  client.on("error", (error) => {
    if (env.NODE_ENV !== "test") console.error("[redis]", error instanceof Error ? error.message : error);
  });
  return client;
}

export const redis: RedisClient | null = env.REDIS_URL
  ? (shared.__aneiRedis ?? (shared.__aneiRedis = buildClient()!))
  : null;

export async function getRedis(): Promise<RedisClient | null> {
  if (!redis) return null;
  if (redis.isOpen) return redis;
  shared.__aneiRedisConnect ??= redis.connect();
  try {
    await shared.__aneiRedisConnect;
    return redis;
  } catch (error) {
    shared.__aneiRedisConnect = undefined;
    throw error;
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
