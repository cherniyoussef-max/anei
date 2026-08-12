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

async function seedUserWithSession(client: Client, role: "USER" | "ADMIN" | "SUPER_ADMIN") {
  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const email = `role-session-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
     values ($1, 'Test User', $2, true, $3, now(), now())`,
    [userId, email, role],
  );
  await client.query(
    `insert into session (id, token, expires_at, created_at, updated_at, user_id)
     values ($1, $2, now() + interval '7 days', now(), now(), $3)`,
    [sessionId, crypto.randomUUID(), userId],
  );
  return userId;
}

test("revoking a user's sessions deletes only that user's session rows", { skip: !url }, async () => {
  await withClient(async (client) => {
    // src/server/auth/session.ts is guarded by `import "server-only"`, which throws
    // outside a Next.js server context. Exercise the same Better Auth mechanism it
    // wraps (auth.$context.internalAdapter.deleteUserSessions) directly instead.
    const { auth } = await import("../../src/server/auth");

    const demotedAdminId = await seedUserWithSession(client, "ADMIN");
    const unrelatedUserId = await seedUserWithSession(client, "USER");

    const context = await auth.$context;
    await context.internalAdapter.deleteUserSessions(demotedAdminId);

    const demotedSessions = await client.query('select id from session where user_id = $1', [demotedAdminId]);
    assert.equal(demotedSessions.rowCount, 0);

    const unrelatedSessions = await client.query('select id from session where user_id = $1', [unrelatedUserId]);
    assert.equal(unrelatedSessions.rowCount, 1);

    await client.query('delete from "user" where id = any($1)', [[demotedAdminId, unrelatedUserId]]);
  });
});
