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
    ["Persona Profile Test", email],
  );
  return rows[0].id as string;
}

async function insertMembership(client: Client, userId: string, persona: string, status = "ACTIVE", isPrimary = false): Promise<string> {
  const { rows } = await client.query(
    `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
     values (gen_random_uuid(), $1, $2, $3, $4, now(), now()) returning id`,
    [userId, persona, status, isPrimary],
  );
  return rows[0].id as string;
}

async function cleanup(client: Client, userId: string) {
  await client.query(`delete from crm_contact where created_by_user_id = $1 or linked_user_id = $1`, [userId]);
  await client.query('delete from "user" where id = $1', [userId]);
}

test("multi-persona: TEACHER and SPECIALIST profiles coexist independently on the same user", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { upsertTeacherProfileTx, upsertSpecialistProfileTx, getTeacherProfileForUser, getSpecialistProfileForUser } = await import(
      "../../src/server/services/persona-profiles"
    );
    const { db } = await import("../../src/server/db");

    const userId = await createBareUser(client, `multi-persona-${crypto.randomUUID()}@example.test`);
    const teacherMembershipId = await insertMembership(client, userId, "TEACHER", "ACTIVE", true);
    const specialistMembershipId = await insertMembership(client, userId, "SPECIALIST", "ACTIVE", false);

    await db.transaction(async (tx) => {
      await upsertTeacherProfileTx(tx, teacherMembershipId, { discipline: "Mathematics", qualification: "Master", experienceYears: 5 });
      await upsertSpecialistProfileTx(tx, specialistMembershipId, { specialty: "Orthophonie", qualification: "Doctorat", experienceYears: 10 });
    });

    const teacherProfile = await getTeacherProfileForUser(userId);
    const specialistProfile = await getSpecialistProfileForUser(userId);
    assert.equal(teacherProfile?.discipline, "Mathematics");
    assert.equal(specialistProfile?.specialty, "Orthophonie");

    // Updating Teacher must not mutate Specialist, and vice versa.
    await db.transaction((tx) => upsertTeacherProfileTx(tx, teacherMembershipId, { discipline: "Physics" }));
    const specialistAfterTeacherUpdate = await getSpecialistProfileForUser(userId);
    assert.equal(specialistAfterTeacherUpdate?.specialty, "Orthophonie", "updating teacher profile must not touch specialist profile");

    await db.transaction((tx) => upsertSpecialistProfileTx(tx, specialistMembershipId, { specialty: "Psychomotricité" }));
    const teacherAfterSpecialistUpdate = await getTeacherProfileForUser(userId);
    assert.equal(teacherAfterSpecialistUpdate?.discipline, "Physics", "updating specialist profile must not touch teacher profile");

    await cleanup(client, userId);
  });
});

test("wrong persona: cannot create a teacher_profile row against an AVS membership", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { upsertTeacherProfileTx } = await import("../../src/server/services/persona-profiles");
    const { db } = await import("../../src/server/db");

    const userId = await createBareUser(client, `wrong-persona-avs-${crypto.randomUUID()}@example.test`);
    const avsMembershipId = await insertMembership(client, userId, "AVS", "ACTIVE", true);

    await assert.rejects(db.transaction((tx) => upsertTeacherProfileTx(tx, avsMembershipId, { discipline: "Math" })), /is AVS, expected TEACHER/);

    const { rows } = await client.query(`select count(*)::int as n from teacher_profile where persona_membership_id = $1`, [avsMembershipId]);
    assert.equal(rows[0].n, 0, "no teacher_profile row must be created against an AVS membership");

    await cleanup(client, userId);
  });
});

test("wrong persona: cannot create a specialist_profile row against a TEACHER membership", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { upsertSpecialistProfileTx } = await import("../../src/server/services/persona-profiles");
    const { db } = await import("../../src/server/db");

    const userId = await createBareUser(client, `wrong-persona-teacher-${crypto.randomUUID()}@example.test`);
    const teacherMembershipId = await insertMembership(client, userId, "TEACHER", "ACTIVE", true);

    await assert.rejects(
      db.transaction((tx) => upsertSpecialistProfileTx(tx, teacherMembershipId, { specialty: "Orthophonie" })),
      /is TEACHER, expected SPECIALIST/,
    );

    const { rows } = await client.query(`select count(*)::int as n from specialist_profile where persona_membership_id = $1`, [teacherMembershipId]);
    assert.equal(rows[0].n, 0);

    await cleanup(client, userId);
  });
});

test("wrong persona: cannot create an avs_profile row against a SPECIALIST membership", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { upsertAvsProfileTx } = await import("../../src/server/services/persona-profiles");
    const { db } = await import("../../src/server/db");

    const userId = await createBareUser(client, `wrong-persona-specialist-${crypto.randomUUID()}@example.test`);
    const specialistMembershipId = await insertMembership(client, userId, "SPECIALIST", "ACTIVE", true);

    await assert.rejects(
      db.transaction((tx) => upsertAvsProfileTx(tx, specialistMembershipId, { qualification: "Formation AVS" })),
      /is SPECIALIST, expected AVS/,
    );

    const { rows } = await client.query(`select count(*)::int as n from avs_profile where persona_membership_id = $1`, [specialistMembershipId]);
    assert.equal(rows[0].n, 0);

    await cleanup(client, userId);
  });
});

test("wrong persona: organization_profile rejected against a TEACHER membership", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { upsertOrganizationProfileTx } = await import("../../src/server/services/persona-profiles");
    const { db } = await import("../../src/server/db");

    const userId = await createBareUser(client, `wrong-persona-org-${crypto.randomUUID()}@example.test`);
    const teacherMembershipId = await insertMembership(client, userId, "TEACHER", "ACTIVE", true);

    await assert.rejects(
      db.transaction((tx) => upsertOrganizationProfileTx(tx, teacherMembershipId, { organizationName: "ANEI" })),
      /is TEACHER, expected ORGANIZATION/,
    );

    await cleanup(client, userId);
  });
});

test("completeUserProfile persists persona-specific fields into the correct table via the onboarding path", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { completeUserProfile } = await import("../../src/server/auth/profile");
    const { getTeacherProfileForUser } = await import("../../src/server/services/persona-profiles");

    const userId = await createBareUser(client, `onboarding-teacher-${crypto.randomUUID()}@example.test`);

    const result = await completeUserProfile(userId, {
      firstName: "Test",
      lastName: "Teacher",
      phoneNumber: "20311900",
      country: "Tunisie",
      governorate: "Tunis",
      city: "Carthage",
      preferredLocale: "fr",
      requestedPersona: "TEACHER",
      discipline: "Mathematics",
      qualification: "Master",
      experienceYears: 5,
      levelsTaught: ["Secondaire"],
      professionalInstitution: "Lycée Pilote",
      termsAccepted: true,
      privacyAccepted: true,
    });
    assert.equal(result.ok, true);

    const profile = await getTeacherProfileForUser(userId);
    assert.equal(profile?.discipline, "Mathematics");
    assert.equal(profile?.experienceYears, 5);
    assert.deepEqual(profile?.levelsTaught, ["Secondaire"]);

    const { rows: userProfileRows } = await client.query(
      `select education_level, institution_name from user_profile where user_id = $1`,
      [userId],
    );
    assert.equal(userProfileRows[0].education_level, null, "TEACHER onboarding must not write into the STUDENT-only userProfile columns");
    assert.equal(userProfileRows[0].institution_name, null);

    await cleanup(client, userId);
  });
});
