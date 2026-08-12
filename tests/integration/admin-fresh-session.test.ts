import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);

async function withClient(run: (client: Client) => Promise<void>) {
  if (!url) return;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

function cookieHeaderFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
}

async function setRole(client: Client, userId: string, role: "USER" | "ADMIN" | "SUPER_ADMIN") {
  await client.query('update "user" set role = $1 where id = $2', [role, userId]);
}

/**
 * These tests exercise real Better Auth sign-up/sign-in against a live database
 * (not mocks) so the cookieCache staleness behavior — and our fix for it — is
 * proven against the actual library, not an assumption about its internals.
 */
async function createSignedInUser(auth: typeof import("../../src/server/auth").auth, client: Client) {
  const email = `fresh-session-${crypto.randomUUID()}@example.test`;
  const password = "correct horse battery staple 1";
  const signUpResponse = await auth.api.signUpEmail({
    body: { email, password, name: "Fresh Session Test" },
    asResponse: true,
  });
  assert.equal(signUpResponse.status, 200, await signUpResponse.clone().text());
  const { rows } = await client.query('select id from "user" where email = $1', [email]);
  const userId = rows[0].id as string;
  return { userId, email, password };
}

async function signIn(auth: typeof import("../../src/server/auth").auth, email: string, password: string) {
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  assert.equal(response.status, 200, await response.clone().text());
  return new Headers({ cookie: cookieHeaderFrom(response) });
}

test("a cached session cookie keeps reporting the role it was issued with", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { auth } = await import("../../src/server/auth");
    const { userId, email, password } = await createSignedInUser(auth, client);
    await setRole(client, userId, "SUPER_ADMIN");
    const headers = await signIn(auth, email, password);

    const cached = await auth.api.getSession({ headers });
    assert.equal(cached?.user.role, "SUPER_ADMIN");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

test("demotions: getSession() with disableCookieCache reflects the new DB role immediately, even though the cached cookie is stale", { skip: !url }, async () => {
  const cases: Array<["ADMIN" | "SUPER_ADMIN", "USER" | "ADMIN"]> = [
    ["ADMIN", "USER"],
    ["SUPER_ADMIN", "ADMIN"],
    ["SUPER_ADMIN", "USER"],
  ];
  for (const [before, after] of cases) {
    await withClient(async (client) => {
      const { auth } = await import("../../src/server/auth");
      const { userId, email, password } = await createSignedInUser(auth, client);
      await setRole(client, userId, before);
      const headers = await signIn(auth, email, password);

      const cachedBeforeDemotion = await auth.api.getSession({ headers });
      assert.equal(cachedBeforeDemotion?.user.role, before);

      // Simulate the role route's DB update without touching the session/cookie.
      await setRole(client, userId, after);

      const staleCached = await auth.api.getSession({ headers });
      assert.equal(staleCached?.user.role, before, "cookieCache is expected to still be stale here — that is the vulnerability being guarded against");

      const fresh = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
      assert.equal(fresh?.user.role, after, `${before} -> ${after} must be visible on the next fresh admin authorization check`);

      await client.query('delete from "user" where id = $1', [userId]);
    });
  }
});

test("promotions: getSession() with disableCookieCache reflects the new DB role immediately", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { auth } = await import("../../src/server/auth");
    const { userId, email, password } = await createSignedInUser(auth, client);
    const headers = await signIn(auth, email, password);

    const cachedBeforePromotion = await auth.api.getSession({ headers });
    assert.equal(cachedBeforePromotion?.user.role, "USER");

    await setRole(client, userId, "SUPER_ADMIN");

    const fresh = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    assert.equal(fresh?.user.role, "SUPER_ADMIN");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

test("a fresh session lookup reflects the demoted role even when session revocation never ran", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { auth } = await import("../../src/server/auth");
    const { userId, email, password } = await createSignedInUser(auth, client);
    await setRole(client, userId, "SUPER_ADMIN");
    const headers = await signIn(auth, email, password);

    // Demote without ever calling revokeUserSessions — simulating a total
    // revocation failure. The session row is still present and unrevoked.
    await setRole(client, userId, "USER");

    const { rows } = await client.query("select count(*)::int as count from session where user_id = $1", [userId]);
    assert.equal(rows[0].count > 0, true, "the (unrevoked) session row must still exist for this to be a meaningful test");

    const fresh = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    assert.equal(fresh?.user.role, "USER");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});
