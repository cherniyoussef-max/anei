import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin user query keeps pagination and sort fields server controlled", async () => {
  const source = await readFile("src/modules/admin/queries/admin-users.ts", "utf8");
  assert.equal(source.includes("limit ${filter.pageSize} offset ${offset}"), true);
  assert.equal(source.includes("userSortFields.includes"), true);
  assert.equal(source.includes("sql.raw("), false);
  assert.equal(source.includes("select *"), false);
});

test("admin analytics aggregate in PostgreSQL and provide empty-data defaults", async () => {
  const source = await readFile("src/modules/admin/queries/admin-analytics.ts", "utf8");
  assert.equal(source.includes("count(*)"), true);
  assert.equal(source.includes("group by"), true);
  assert.equal(source.includes("?? 0"), true);
});

test("admin users and dashboard caches degrade to a direct DB read on Redis outage instead of throwing", async () => {
  const [usersSource, analyticsSource] = await Promise.all([
    readFile("src/modules/admin/queries/admin-users.ts", "utf8"),
    readFile("src/modules/admin/queries/admin-analytics.ts", "utf8"),
  ]);

  // getRedis() (via the swappable redisResolver seam) rejects on a failed
  // connect; every call site must catch that so a Redis outage falls back
  // to the DB query instead of failing the page.
  assert.equal(usersSource.includes("redisResolver().catch("), true);
  assert.equal(usersSource.includes("redis.get(cacheKey).catch(() => null)"), true);
  assert.equal(usersSource.match(/\.catch\(\(\) => undefined\)/g)?.length, 2, "both list and detail cache writes must be fault-tolerant");

  assert.equal(analyticsSource.includes("redisResolver().catch("), true);
  assert.equal(analyticsSource.includes("redis.get(cacheKey).catch(() => null)"), true);
  assert.equal(analyticsSource.includes(".catch(() => undefined)"), true);
});

// Behavioral coverage for the corrupt-cache-degrades-to-DB path lives in
// tests/integration/admin-cache-corruption.test.ts (these modules are
// server-only and require --conditions=react-server to import directly).
test("admin cache corruption is never logged with String(error), since JSON.parse's SyntaxError can embed the malformed payload", async () => {
  const [usersSource, analyticsSource] = await Promise.all([
    readFile("src/modules/admin/queries/admin-users.ts", "utf8"),
    readFile("src/modules/admin/queries/admin-analytics.ts", "utf8"),
  ]);

  assert.equal(usersSource.includes('error instanceof Error ? error.name : "unknown"'), true);
  assert.equal(analyticsSource.includes('error instanceof Error ? error.name : "unknown"'), true);
});

test("Google provider is conditional and credentials remain server-only", async () => {
  const [authSource, clientSource, formSource] = await Promise.all([
    readFile("src/server/auth/index.ts", "utf8"),
    readFile("src/lib/auth-client.ts", "utf8"),
    readFile("src/components/interactive/AuthForm.tsx", "utf8"),
  ]);
  assert.equal(authSource.includes("socialProviders: googleAuthConfigured"), true);
  assert.equal(authSource.includes("clientSecret: env.GOOGLE_CLIENT_SECRET"), true);
  assert.equal(clientSource.includes("GOOGLE_CLIENT_SECRET"), false);
  assert.equal(formSource.includes('provider: "google"'), true);
  assert.equal(authSource.includes("oneTap()"), false);
  assert.equal(authSource.includes("encryptOAuthTokens: true"), true);
});
