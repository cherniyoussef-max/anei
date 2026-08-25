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
