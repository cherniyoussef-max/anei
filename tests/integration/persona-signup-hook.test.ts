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

/**
 * Exercises the real Better Auth `user.create.after` hook (wired in
 * src/server/auth/index.ts) end-to-end against a live database — proving the
 * signup flow actually produces a persona_membership row, not just the
 * service function in isolation.
 */
test("signing up creates exactly one primary persona_membership row, mapped from profileType", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { auth } = await import("../../src/server/auth");

    const email = `persona-signup-${crypto.randomUUID()}@example.test`;
    const response = await auth.api.signUpEmail({
      body: { email, password: "correct horse battery staple 1", name: "Persona Signup Test", profileType: "avs" },
      asResponse: true,
    });
    assert.equal(response.status, 200, await response.clone().text());

    const { rows } = await client.query('select id from "user" where email = $1', [email]);
    const userId = rows[0].id as string;

    const memberships = await client.query(
      `select persona, status, is_primary from persona_membership where user_id = $1`,
      [userId],
    );
    assert.equal(memberships.rowCount, 1);
    assert.equal(memberships.rows[0].persona, "AVS");
    assert.equal(memberships.rows[0].status, "PENDING_REVIEW");
    assert.equal(memberships.rows[0].is_primary, true);

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

test("signing up with a malformed/unsupported profileType is rejected end-to-end: no user row and no persona row are created", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { auth } = await import("../../src/server/auth");

    for (const profileType of ["hacker", "ADMIN", "TEACHER", ""]) {
      const email = `persona-signup-rejected-${crypto.randomUUID()}@example.test`;
      const response = await auth.api.signUpEmail({
        body: { email, password: "correct horse battery staple 1", name: "Malformed Persona Test", profileType: profileType as "learner" },
        asResponse: true,
      });
      assert.notEqual(response.status, 200, `expected profileType "${profileType}" to be rejected`);

      const { rows } = await client.query('select id from "user" where email = $1', [email]);
      assert.equal(rows.length, 0, `no user row should exist for rejected profileType "${profileType}"`);
    }
  });
});

test("signing up without an explicit profileType defaults to a STUDENT persona, immediately ACTIVE", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { auth } = await import("../../src/server/auth");

    const email = `persona-signup-default-${crypto.randomUUID()}@example.test`;
    const response = await auth.api.signUpEmail({
      body: { email, password: "correct horse battery staple 1", name: "Persona Signup Default Test" },
      asResponse: true,
    });
    assert.equal(response.status, 200, await response.clone().text());

    const { rows } = await client.query('select id from "user" where email = $1', [email]);
    const userId = rows[0].id as string;

    const memberships = await client.query(
      `select persona, status, is_primary from persona_membership where user_id = $1`,
      [userId],
    );
    assert.equal(memberships.rowCount, 1);
    assert.equal(memberships.rows[0].persona, "STUDENT");
    assert.equal(memberships.rows[0].status, "ACTIVE");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});
