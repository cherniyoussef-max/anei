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

test("Phase 11 auth tables exist", { skip: !url }, async () => {
  await withClient(async (client) => {
    const result = await client.query<{ table_name: string }>(`
      select table_name from information_schema.tables
      where table_schema='public'
        and table_name in (
          'user_profile',
          'auth_session_assurance',
          'auth_verification_challenge',
          'auth_reset_authorization',
          'auth_event'
        )
      order by table_name
    `);
    assert.equal(result.rowCount, 5);
  });
});

test("auth_session_assurance enforces one row per session", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    await client.query("begin");
    try {
      await client.query(
        `insert into "user" (id,name,email,email_verified,role,locale,profile_type,created_at,updated_at)
         values ($1,'Auth Tester',$2,true,'USER','fr','learner',now(),now())`,
        [userId, `${userId}@example.test`],
      );
      await client.query(
        `insert into "session" (id,expires_at,token,created_at,updated_at,user_id)
         values ($1, now() + interval '1 day', $2, now(), now(), $3)`,
        [sessionId, `tok-${sessionId}`, userId],
      );
      await client.query(
        `insert into auth_session_assurance (id,session_id,user_id,method,verified_at,completed_at,expires_at,created_at,updated_at)
         values ($1,$2,$3,'EMAIL',now(),now(),now()+interval '1 day',now(),now())`,
        [crypto.randomUUID(), sessionId, userId],
      );

      await assert.rejects(
        client.query(
          `insert into auth_session_assurance (id,session_id,user_id,method,verified_at,completed_at,expires_at,created_at,updated_at)
           values ($1,$2,$3,'WHATSAPP',now(),now(),now()+interval '1 day',now(),now())`,
          [crypto.randomUUID(), sessionId, userId],
        ),
        /auth_session_assurance_session_unique|duplicate key/i,
      );
    } finally {
      await client.query("rollback");
    }
  });
});

test("auth_verification_challenge channel and status are allowlisted", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = crypto.randomUUID();

    await client.query("begin");
    try {
      await client.query(
        `insert into "user" (id,name,email,email_verified,role,locale,profile_type,created_at,updated_at)
         values ($1,'Challenge Tester',$2,true,'USER','fr','learner',now(),now())`,
        [userId, `${userId}@example.test`],
      );

      await client.query("savepoint invalid_channel");
      await assert.rejects(
        client.query(
          `insert into auth_verification_challenge
            (id,user_id,purpose,channel,destination,destination_masked,code_hash,status,attempt_count,max_attempts,resend_available_at,expires_at,delivery_version,created_at,updated_at)
           values
            ($1,$2,'LOGIN','SMS','+21611111111','+216**111','x','ACTIVE',0,3,now(),now()+interval '5 minute',1,now(),now())`,
          [crypto.randomUUID(), userId],
        ),
        /auth_verification_challenge_channel_check|check constraint/i,
      );
      await client.query("rollback to savepoint invalid_channel");

      await client.query("savepoint invalid_status");
      await assert.rejects(
        client.query(
          `insert into auth_verification_challenge
            (id,user_id,purpose,channel,destination,destination_masked,code_hash,status,attempt_count,max_attempts,resend_available_at,expires_at,delivery_version,created_at,updated_at)
           values
            ($1,$2,'LOGIN','EMAIL','user@example.test','u***@example.test','x','RANDOM',0,3,now(),now()+interval '5 minute',1,now(),now())`,
          [crypto.randomUUID(), userId],
        ),
        /auth_verification_challenge_status_check|check constraint/i,
      );
      await client.query("rollback to savepoint invalid_status");
    } finally {
      await client.query("rollback");
    }
  });
});
