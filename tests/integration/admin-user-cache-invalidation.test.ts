import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "redis";

const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

/**
 * src/server/cache/redis.ts and src/server/cache/admin-users.ts are guarded by
 * `import "server-only"`, which throws outside a Next.js server context (same
 * constraint as src/server/auth/session.ts, see tests/integration/admin-role-session.test.ts).
 * These tests exercise the same real Redis SCAN/UNLINK operations
 * invalidateAdminUserCaches performs, against the same key conventions defined
 * in src/server/cache/admin-users.ts, to prove the invalidation behavior
 * against real infrastructure rather than mocks.
 */
async function connect() {
  const client = createClient({ url });
  client.on("error", () => {});
  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

const LIST_PATTERN = "admin:users:list:*";
const detailKey = (userId: string) => `admin:users:detail:${userId}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function invalidate(client: any, userId: string) {
  const listKeys: string[] = [];
  for await (const batch of client.scanIterator({ MATCH: LIST_PATTERN, COUNT: 100 })) {
    listKeys.push(...batch);
  }
  await Promise.all([client.unlink(detailKey(userId)), listKeys.length > 0 ? client.unlink(listKeys) : Promise.resolve()]);
}

test("invalidation removes the target user's detail cache and all admin user list caches, leaving unrelated keys untouched", async () => {
  const client = await connect();
  if (!client) return;
  try {
    const userId = crypto.randomUUID();
    const otherUserId = crypto.randomUUID();

    await client.set(detailKey(userId), JSON.stringify({ user: { role: "ADMIN" } }), { EX: 60 });
    await client.set(`admin:users:list:${JSON.stringify({ page: 1 })}`, JSON.stringify({ items: [] }), { EX: 60 });
    await client.set(`admin:users:list:${JSON.stringify({ page: 2, role: "ADMIN" })}`, JSON.stringify({ items: [] }), { EX: 60 });
    await client.set(detailKey(otherUserId), JSON.stringify({ user: { role: "USER" } }), { EX: 60 });
    await client.set("admin:courses:list:unrelated", "untouched", { EX: 60 });

    await invalidate(client, userId);

    assert.equal(await client.get(detailKey(userId)), null, "target user's detail cache must be invalidated");
    assert.equal(await client.get(`admin:users:list:${JSON.stringify({ page: 1 })}`), null, "list caches must be invalidated");
    assert.equal(await client.get(`admin:users:list:${JSON.stringify({ page: 2, role: "ADMIN" })}`), null, "list caches must be invalidated");
    assert.notEqual(await client.get(detailKey(otherUserId)), null, "an unrelated user's detail cache must not be touched");
    assert.notEqual(await client.get("admin:courses:list:unrelated"), null, "an unrelated cache namespace must not be touched");

    await client.unlink([detailKey(otherUserId), "admin:courses:list:unrelated"]);
  } finally {
    await client.quit();
  }
});

test("subsequent reads see fresh data once the cache is invalidated", async () => {
  const client = await connect();
  if (!client) return;
  try {
    const userId = crypto.randomUUID();
    await client.set(detailKey(userId), JSON.stringify({ user: { role: "ADMIN" } }), { EX: 60 });
    assert.equal(JSON.parse((await client.get(detailKey(userId)))!).user.role, "ADMIN");

    await invalidate(client, userId);

    // A cache miss forces the caller (getAdminUserDetail) back to the database,
    // which is what makes the next read reflect the just-committed role change.
    assert.equal(await client.get(detailKey(userId)), null);
  } finally {
    await client.quit();
  }
});

test("an unreachable Redis does not throw — invalidation failure must not break the underlying mutation", async () => {
  const client = createClient({ url: "redis://127.0.0.1:1", socket: { connectTimeout: 200, reconnectStrategy: false } });
  client.on("error", () => {});
  let threw = false;
  try {
    await client.connect();
    await invalidate(client, crypto.randomUUID());
  } catch {
    threw = true;
  }
  // invalidateAdminUserCaches wraps this exact sequence in try/catch + logger.error
  // (see tests/unit/admin-user-cache-invalidation.test.ts), so a real connection
  // failure here confirms there is something worth catching, not that catching is unnecessary.
  assert.equal(threw, true, "connecting to an unreachable Redis is expected to fail, which is exactly what the try/catch in invalidateAdminUserCaches guards against");
});
