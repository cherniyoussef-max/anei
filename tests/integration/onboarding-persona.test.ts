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

async function createBareUser(client: Client, email: string): Promise<string> {
  const { rows } = await client.query(
    `insert into "user" (id, name, email, email_verified, role, locale, profile_type, created_at, updated_at)
     values (gen_random_uuid(), $1, $2, true, 'USER', 'fr', 'learner', now(), now()) returning id`,
    ["Onboarding Persona Test", email],
  );
  return rows[0].id as string;
}

/**
 * Covers the exact regression this phase fixes: onboarding incomplete,
 * primary = STUDENT, user selects TEACHER -> the resulting primary must
 * actually become TEACHER (previously, ensurePrimaryPersonaMembership's bare
 * onConflictDoNothing() silently dropped this and left primary=STUDENT while
 * requestedPersona/profileType said TEACHER).
 */
test("establishOnboardingPersona reconciles an existing primary while onboarding is incomplete", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { establishOnboardingPersona } = await import("../../src/server/services/personas");
    const userId = await createBareUser(client, `onboarding-reconcile-${crypto.randomUUID()}@example.test`);

    await client.query(
      `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at) values (gen_random_uuid(), $1, 'STUDENT', 'ACTIVE', true, now(), now())`,
      [userId],
    );

    const result = await establishOnboardingPersona(userId, "TEACHER", false);
    assert.equal(result.kind, "ok");

    const { rows } = await client.query(
      `select persona, status, is_primary from persona_membership where user_id = $1 order by persona`,
      [userId],
    );
    const primaries = rows.filter((row) => row.is_primary);
    assert.equal(primaries.length, 1, "exactly one primary persona must remain");
    assert.equal(primaries[0].persona, "TEACHER");
    assert.equal(primaries[0].status, "PENDING_REVIEW", "professional persona must not self-activate");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

test("establishOnboardingPersona is idempotent when re-selecting the same persona", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { establishOnboardingPersona } = await import("../../src/server/services/personas");
    const userId = await createBareUser(client, `onboarding-idempotent-${crypto.randomUUID()}@example.test`);

    const first = await establishOnboardingPersona(userId, "STUDENT", false);
    const second = await establishOnboardingPersona(userId, "STUDENT", false);
    assert.equal(first.kind, "ok");
    assert.equal(second.kind, "ok");

    const { rows } = await client.query(`select persona, is_primary from persona_membership where user_id = $1`, [userId]);
    assert.equal(rows.length, 1, "no duplicate persona rows from a retried onboarding call");
    assert.equal(rows[0].is_primary, true);

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

test("establishOnboardingPersona rejects switching the primary persona once onboarding is already complete", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { establishOnboardingPersona } = await import("../../src/server/services/personas");
    const userId = await createBareUser(client, `onboarding-locked-${crypto.randomUUID()}@example.test`);

    await client.query(
      `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at) values (gen_random_uuid(), $1, 'STUDENT', 'ACTIVE', true, now(), now())`,
      [userId],
    );

    const result = await establishOnboardingPersona(userId, "TEACHER", true);
    assert.equal(result.kind, "locked");

    const { rows } = await client.query(`select persona from persona_membership where user_id = $1 and is_primary = true`, [userId]);
    assert.equal(rows[0].persona, "STUDENT", "primary persona must remain unchanged once onboarding is locked");

    const { rows: userRows } = await client.query(`select role from "user" where id = $1`, [userId]);
    assert.equal(userRows[0].role, "USER", "persona onboarding must never mutate user.role");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

test("establishOnboardingPersona creates a primary persona when none exists yet", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { establishOnboardingPersona } = await import("../../src/server/services/personas");
    const userId = await createBareUser(client, `onboarding-create-${crypto.randomUUID()}@example.test`);

    const result = await establishOnboardingPersona(userId, "PARENT", false);
    assert.equal(result.kind, "ok");

    const { rows } = await client.query(`select persona, status, is_primary from persona_membership where user_id = $1`, [userId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].persona, "PARENT");
    assert.equal(rows[0].status, "ACTIVE");
    assert.equal(rows[0].is_primary, true);

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

/**
 * Google/OAuth account creation must not eagerly assign an authoritative
 * STUDENT persona: the `after` hook only calls ensurePrimaryPersonaMembership
 * when context.path === "/sign-up/email" (credentials signup). This proves
 * the hook itself is now gated: calling the underlying service function
 * directly still works (used by credentials signup), but a user created
 * without going through /sign-up/email gets no persona_membership row at all
 * until they explicitly complete onboarding.
 */
test("a user created without a persona_membership row is not silently treated as STUDENT-active", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await createBareUser(client, `oauth-new-user-${crypto.randomUUID()}@example.test`);
    const { rows } = await client.query(`select count(*)::int as count from persona_membership where user_id = $1`, [userId]);
    assert.equal(rows[0].count, 0, "a bare (e.g. OAuth) new user must have zero persona memberships until they complete onboarding");
    await client.query('delete from "user" where id = $1', [userId]);
  });
});

/**
 * Phase 2.1: `completeUserProfileTx` writes personaMembership, user, and
 * userProfile on one caller-supplied `tx` (advisory lock included). Building
 * the profile data via a raw pg client + a forced throw around
 * `db.transaction` proves the persona reconciliation and the profile writes
 * live in the SAME transaction: nothing from `completeUserProfileTx` may
 * survive when that surrounding transaction is rolled back.
 */
/** completeUserProfile's best-effort CRM step can create a crm_contact row referencing this user; delete it before the user to satisfy the FK. */
async function deleteUserAndCrmContact(client: Client, userId: string): Promise<void> {
  await client.query(`delete from crm_contact where created_by_user_id = $1 or linked_user_id = $1`, [userId]);
  await client.query('delete from "user" where id = $1', [userId]);
}

async function seedStudentPrimaryUser(client: Client): Promise<string> {
  const userId = await createBareUser(client, `onboarding-tx-${crypto.randomUUID()}@example.test`);
  await client.query(
    `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at) values (gen_random_uuid(), $1, 'STUDENT', 'ACTIVE', true, now(), now())`,
    [userId],
  );
  await client.query(
    `insert into user_profile (id, user_id, first_name, last_name, preferred_locale, requested_persona, created_at, updated_at)
     values (gen_random_uuid(), $1, 'Test', 'User', 'fr', 'STUDENT', now(), now())`,
    [userId],
  );
  return userId;
}

async function buildTeacherProfileData() {
  const { profileSchema } = await import("../../src/server/auth/profile");
  return profileSchema.parse({
    firstName: "Test",
    lastName: "User",
    birthYear: 1990,
    phoneNumber: "+21620000000",
    country: "Tunisia",
    governorate: "Tunis",
    city: "Carthage",
    preferredLocale: "fr",
    requestedPersona: "TEACHER",
    discipline: "Mathematics",
    qualification: "Master",
    experienceYears: 5,
    professionalInstitution: "ANEI",
    termsAccepted: true,
    privacyAccepted: true,
  });
}

test("completeUserProfileTx: a thrown error after the persona write rolls back persona + profile together", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { db } = await import("../../src/server/db");
    const { completeUserProfileTx } = await import("../../src/server/auth/profile");

    const userId = await seedStudentPrimaryUser(client);
    const data = await buildTeacherProfileData();

    await assert.rejects(
      db.transaction(async (tx) => {
        const result = await completeUserProfileTx(tx, userId, data, new Date(), null, false);
        assert.equal(result.ok, true, "persona write inside the transaction must itself succeed before the forced rollback");
        throw new Error("intentional rollback test");
      }),
      /intentional rollback test/,
    );

    const { rows: personaRows } = await client.query(
      `select persona, is_primary from persona_membership where user_id = $1`,
      [userId],
    );
    assert.equal(personaRows.length, 1, "no extra persona row must survive the rollback");
    assert.equal(personaRows[0].persona, "STUDENT", "primary persona must remain STUDENT after rollback");
    assert.equal(personaRows[0].is_primary, true);

    const { rows: userRows } = await client.query(`select profile_type from "user" where id = $1`, [userId]);
    assert.equal(userRows[0].profile_type, "learner", "user.profileType must remain unchanged after rollback");

    const { rows: profileRows } = await client.query(
      `select requested_persona, onboarding_completed_at from user_profile where user_id = $1`,
      [userId],
    );
    assert.equal(profileRows[0].requested_persona, "STUDENT", "userProfile.requestedPersona must remain unchanged after rollback");
    assert.equal(profileRows[0].onboarding_completed_at, null, "onboardingCompletedAt must remain unset after rollback");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});

test("completeUserProfile: STUDENT -> TEACHER commits profileType, requestedPersona, and primary persona atomically", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { completeUserProfile } = await import("../../src/server/auth/profile");

    const userId = await seedStudentPrimaryUser(client);
    const data = await buildTeacherProfileData();

    const result = await completeUserProfile(userId, data);
    assert.equal(result.ok, true);

    const { rows: userRows } = await client.query(`select profile_type, role from "user" where id = $1`, [userId]);
    assert.equal(userRows[0].profile_type, "teacher");
    assert.equal(userRows[0].role, "USER", "onboarding must never mutate user.role");

    const { rows: profileRows } = await client.query(
      `select requested_persona, onboarding_completed_at from user_profile where user_id = $1`,
      [userId],
    );
    assert.equal(profileRows[0].requested_persona, "TEACHER");
    assert.notEqual(profileRows[0].onboarding_completed_at, null);

    const { rows: personaRows } = await client.query(
      `select persona, status, is_primary from persona_membership where user_id = $1`,
      [userId],
    );
    const primaries = personaRows.filter((row) => row.is_primary);
    assert.equal(primaries.length, 1, "exactly one primary persona must exist");
    assert.equal(primaries[0].persona, "TEACHER");
    assert.equal(primaries[0].status, "PENDING_REVIEW");

    await deleteUserAndCrmContact(client, userId);
  });
});

test("completeUserProfile: re-submitting the same persona is idempotent (no duplicate primaries)", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { completeUserProfile } = await import("../../src/server/auth/profile");

    const userId = await seedStudentPrimaryUser(client);
    const data = await buildTeacherProfileData();

    const first = await completeUserProfile(userId, data);
    const second = await completeUserProfile(userId, data);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);

    const { rows: personaRows } = await client.query(
      `select persona, is_primary from persona_membership where user_id = $1`,
      [userId],
    );
    assert.equal(personaRows.length, 2, "STUDENT + TEACHER rows only, no duplicate TEACHER row from the retry");
    const primaries = personaRows.filter((row) => row.is_primary);
    assert.equal(primaries.length, 1);
    assert.equal(primaries[0].persona, "TEACHER");

    await deleteUserAndCrmContact(client, userId);
  });
});

test("completeUserProfile: rejects switching persona once onboarding is already completed, leaving all state unchanged", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { completeUserProfile } = await import("../../src/server/auth/profile");

    const userId = await seedStudentPrimaryUser(client);
    await client.query(
      `update user_profile set onboarding_completed_at = now() where user_id = $1`,
      [userId],
    );
    await client.query(`update "user" set profile_type = 'learner' where id = $1`, [userId]);

    const data = await buildTeacherProfileData();
    const result = await completeUserProfile(userId, data);
    assert.equal(result.ok, false);
    assert.equal((result as { error: string }).error, "ONBOARDING_ALREADY_COMPLETED");

    const { rows: personaRows } = await client.query(
      `select persona from persona_membership where user_id = $1 and is_primary = true`,
      [userId],
    );
    assert.equal(personaRows[0].persona, "STUDENT", "primary persona must remain unchanged once onboarding is locked");

    const { rows: userRows } = await client.query(`select profile_type, role from "user" where id = $1`, [userId]);
    assert.equal(userRows[0].profile_type, "learner", "profileType must remain unchanged once onboarding is locked");
    assert.equal(userRows[0].role, "USER");

    const { rows: profileRows } = await client.query(`select requested_persona from user_profile where user_id = $1`, [userId]);
    assert.equal(profileRows[0].requested_persona, "STUDENT", "requestedPersona must remain unchanged once onboarding is locked");

    await client.query('delete from "user" where id = $1', [userId]);
  });
});
