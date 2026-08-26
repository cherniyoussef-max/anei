import test from "node:test";
import assert from "node:assert/strict";
import type { getRedis } from "@/server/cache/redis";

type FakeRedisResolverClient = Awaited<ReturnType<typeof getRedis>>;

/**
 * src/modules/admin/queries/admin-analytics.ts and admin-users.ts are guarded
 * by `import "server-only"`, which throws outside a Next.js server context
 * (same constraint documented in tests/integration/admin-user-cache-invalidation.test.ts).
 * Run under `npm run test:integration` (--conditions=react-server).
 *
 * These tests inject a fake Redis client via the modules' test-only resolver
 * seams to prove *behaviorally* that a corrupted/malformed cached value is
 * treated as a cache miss (falls through to the real DB query and returns a
 * usable result) rather than throwing, and that the corruption is logged
 * without ever including the raw cached payload.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeRedis(overrides: Partial<{ get: (key: string) => Promise<string | null>; set: (...args: any[]) => Promise<unknown> }>) {
  return {
    get: overrides.get ?? (async () => null),
    set: overrides.set ?? (async () => "OK"),
  } as unknown as FakeRedisResolverClient;
}

test("admin dashboard cache: corrupted JSON degrades to a live DB read instead of throwing", async (t) => {
  const { getAdminOverview, setAdminDashboardRedisResolverForTests } = await import("@/modules/admin/queries/admin-analytics");
  const errorSpy = t.mock.method(console, "error", () => {});
  const cached = "{ this is not valid json";
  setAdminDashboardRedisResolverForTests(async () => fakeRedis({ get: async () => cached }));
  try {
    const overview = await getAdminOverview("30d");
    assert.equal(overview.period, "30d");
    assert.equal(typeof overview.totalUsers, "number", "must fall through to a real DB-computed value, not throw");

    const logged = errorSpy.mock.calls.map((call) => String(call.arguments[0]));
    assert.ok(logged.some((line) => line.includes("admin.dashboard_cache_corrupt")), "corruption must be logged");
    assert.ok(!logged.some((line) => line.includes(cached)), "the raw corrupted payload must never be logged");
  } finally {
    setAdminDashboardRedisResolverForTests(null);
    errorSpy.mock.restore();
  }
});

test("admin dashboard cache: a valid cached value is still returned without recomputing", async () => {
  const { getAdminDistributions, setAdminDashboardRedisResolverForTests } = await import("@/modules/admin/queries/admin-analytics");
  const sentinel = { roles: [{ label: "sentinel", value: 999 }], providers: [], topCourses: [] };
  setAdminDashboardRedisResolverForTests(async () => fakeRedis({ get: async () => JSON.stringify(sentinel) }));
  try {
    const result = await getAdminDistributions();
    assert.deepEqual(result, sentinel, "a well-formed cache hit must short-circuit the DB query");
  } finally {
    setAdminDashboardRedisResolverForTests(null);
  }
});

test("admin users list cache: corrupted JSON degrades to a live DB read instead of throwing", async (t) => {
  const { getAdminUsers, setAdminUsersRedisResolverForTests } = await import("@/modules/admin/queries/admin-users");
  const errorSpy = t.mock.method(console, "error", () => {});
  const cached = "not json at all";
  setAdminUsersRedisResolverForTests(async () => fakeRedis({ get: async () => cached }));
  try {
    const result = await getAdminUsers({ page: 1, pageSize: 10 });
    assert.equal(typeof result.total, "number", "must fall through to a real DB-computed value, not throw");
    assert.ok(Array.isArray(result.items));

    const logged = errorSpy.mock.calls.map((call) => String(call.arguments[0]));
    assert.ok(logged.some((line) => line.includes("admin.users_cache_corrupt")), "corruption must be logged");
    assert.ok(!logged.some((line) => line.includes(cached)), "the raw corrupted payload must never be logged");
  } finally {
    setAdminUsersRedisResolverForTests(null);
    errorSpy.mock.restore();
  }
});

test("admin user detail cache: corrupted JSON degrades to a live DB read instead of throwing", async (t) => {
  const { getAdminUserDetail, setAdminUsersRedisResolverForTests } = await import("@/modules/admin/queries/admin-users");
  const errorSpy = t.mock.method(console, "error", () => {});
  const cached = "{{{corrupt";
  setAdminUsersRedisResolverForTests(async () => fakeRedis({ get: async () => cached }));
  try {
    const result = await getAdminUserDetail(crypto.randomUUID());
    assert.equal(result, null, "an unknown id must fall through to the DB and resolve normally (not throw) after a corrupt cache read");

    const logged = errorSpy.mock.calls.map((call) => String(call.arguments[0]));
    assert.ok(logged.some((line) => line.includes("admin.users_cache_corrupt")), "corruption must be logged");
    assert.ok(!logged.some((line) => line.includes(cached)), "the raw corrupted payload must never be logged");
  } finally {
    setAdminUsersRedisResolverForTests(null);
    errorSpy.mock.restore();
  }
});
