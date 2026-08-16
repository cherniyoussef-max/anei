/**
 * Behavioral regression coverage for Phase 7 (enrollments source tracking,
 * cohorts, teacher-course assignment) against a real database. Follows the
 * pattern in tests/integration/admissions.test.ts / relationships.test.ts.
 */
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

async function seedUser(client: Client) {
  const userId = crypto.randomUUID();
  const email = `lms-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

async function seedUserWithPersona(client: Client, persona: "STUDENT" | "TEACHER") {
  const userId = await seedUser(client);
  await client.query(
    `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
     values ($1, $2, $3, 'ACTIVE', true, now(), now())`,
    [crypto.randomUUID(), userId, persona],
  );
  return userId;
}

async function seedCourse(client: Client) {
  const courseId = crypto.randomUUID();
  await client.query(
    `insert into courses
      (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
       category, level, mode, trainer_name, duration_minutes, price_millimes, published, featured,
       objectives, created_at, updated_at)
     values ($1,$2,'Course','دورة','Sum','ملخص','Desc','وصف','test','beginner','online',
             'ANEI',60,0,true,false,$3::jsonb,now(),now())`,
    [courseId, `lms-course-${courseId}`, JSON.stringify({ fr: [], ar: [] })],
  );
  return courseId;
}

async function seedContact(adminId: string, orgId: string, firstName: string, lastName: string) {
  const { createCrmContact } = await import("../../src/server/services/crm");
  const result = await createCrmContact(adminId, orgId, { firstName, lastName });
  assert.ok(result.kind === "ok");
  return result;
}

async function cleanup(client: Client, orgIds: string[], userIds: string[], courseIds: string[]) {
  await client.query("delete from cohort_membership where cohort_id in (select id from cohort where organization_id = any($1))", [orgIds]);
  await client.query("delete from cohort where organization_id = any($1) or course_id = any($2)", [orgIds, courseIds]);
  await client.query("delete from teacher_course_assignment where teacher_user_id = any($1) or course_id = any($2)", [userIds, courseIds]);
  await client.query("delete from lesson_progress where enrollment_id in (select id from enrollments where user_id = any($1))", [userIds]);
  await client.query("delete from enrollments where user_id = any($1) or course_id = any($2)", [userIds, courseIds]);
  await client.query("delete from admission where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact where organization_id = any($1)", [orgIds]);
  await client.query("delete from organization where id = any($1)", [orgIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
  if (courseIds.length) await client.query("delete from courses where id = any($1)", [courseIds]);
}

test("enrollStudent: TEST_PASS/ORGANIZATION-sourced enrollment grants identical getLearningCourse access as PAYMENT-sourced", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { enrollStudent } = await import("../../src/server/services/enrollments");
    const { getLearningCourse } = await import("../../src/server/queries/account");

    const adminId = await seedUser(client);
    const studentId = await seedUserWithPersona(client, "STUDENT");
    const courseId = await seedCourse(client);
    const [{ slug }] = (await client.query("select slug from courses where id = $1", [courseId])).rows;

    const result = await enrollStudent(adminId, null, { userId: studentId, courseId, source: "TEST_PASS" });
    assert.equal(result.kind, "ok");
    assert.ok(result.kind === "ok" && result.created);

    const course = await getLearningCourse(studentId, slug);
    assert.ok(course, "TEST_PASS-sourced enrollment must grant identical course access as a PAYMENT-sourced one");
    assert.equal(course!.enrollment.source, "TEST_PASS");

    await cleanup(client, [], [adminId, studentId], [courseId]);
  });
});

test("enrollStudent: duplicate enrollment is idempotent — second call reports created:false, no second row", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { enrollStudent } = await import("../../src/server/services/enrollments");

    const adminId = await seedUser(client);
    const studentId = await seedUserWithPersona(client, "STUDENT");
    const courseId = await seedCourse(client);

    const first = await enrollStudent(adminId, null, { userId: studentId, courseId, source: "ADMIN" });
    assert.ok(first.kind === "ok" && first.created);
    const second = await enrollStudent(adminId, null, { userId: studentId, courseId, source: "ADMIN" });
    assert.ok(second.kind === "ok" && !second.created);
    assert.equal(first.enrollmentId, second.enrollmentId);

    const count = await client.query("select count(*)::int as n from enrollments where user_id = $1 and course_id = $2", [studentId, courseId]);
    assert.equal(count.rows[0].n, 1);

    await cleanup(client, [], [adminId, studentId], [courseId]);
  });
});

test("enrollStudent: concurrent duplicate enrollment creates at most one logical enrollment", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { enrollStudent } = await import("../../src/server/services/enrollments");

    const adminId = await seedUser(client);
    const studentId = await seedUserWithPersona(client, "STUDENT");
    const courseId = await seedCourse(client);

    const [resultA, resultB] = await Promise.all([
      enrollStudent(adminId, null, { userId: studentId, courseId, source: "ADMIN" }),
      enrollStudent(adminId, null, { userId: studentId, courseId, source: "ADMIN" }),
    ]);
    assert.equal(resultA.kind, "ok");
    assert.equal(resultB.kind, "ok");
    assert.ok(resultA.kind === "ok" && resultB.kind === "ok" && resultA.enrollmentId === resultB.enrollmentId);

    const count = await client.query("select count(*)::int as n from enrollments where user_id = $1 and course_id = $2", [studentId, courseId]);
    assert.equal(count.rows[0].n, 1);

    await cleanup(client, [], [adminId, studentId], [courseId]);
  });
});

test("enrollStudent: no STUDENT persona is denied enrollment", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { enrollStudent } = await import("../../src/server/services/enrollments");

    const adminId = await seedUser(client);
    const notStudent = await seedUser(client);
    const courseId = await seedCourse(client);

    const result = await enrollStudent(adminId, null, { userId: notStudent, courseId, source: "ADMIN" });
    assert.equal(result.kind, "invalid_persona");

    const count = await client.query("select count(*)::int as n from enrollments where user_id = $1", [notStudent]);
    assert.equal(count.rows[0].n, 0);

    await cleanup(client, [], [adminId, notStudent], [courseId]);
  });
});

test("cohort enrollment: cross-org cohort is rejected (org IDOR) — Org A cannot use Org B's cohort", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCohort } = await import("../../src/server/services/cohorts");
    const { enrollStudent } = await import("../../src/server/services/enrollments");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `lms-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `lms-b-${crypto.randomUUID()}` }, ownerBId);
    const courseId = await seedCourse(client);
    const studentId = await seedUserWithPersona(client, "STUDENT");

    const cohortB = await createCohort(adminId, orgB.id, { courseId, name: "Cohort B" });
    assert.ok(cohortB.kind === "ok");

    // Org A actor attempts to enroll into Org B's cohort.
    const result = await enrollStudent(adminId, orgA.id, { userId: studentId, courseId, cohortId: cohortB.id, source: "ORGANIZATION" });
    assert.equal(result.kind, "invalid_cohort");

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId, studentId], [courseId]);
  });
});

test("cohort capacity: concurrent enrollments never exceed capacity", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createCohort } = await import("../../src/server/services/cohorts");
    const { enrollStudent } = await import("../../src/server/services/enrollments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Cap Org", slug: `lms-cap-${crypto.randomUUID()}` }, ownerId);
    const courseId = await seedCourse(client);
    const studentA = await seedUserWithPersona(client, "STUDENT");
    const studentB = await seedUserWithPersona(client, "STUDENT");

    const cohortResult = await createCohort(adminId, org.id, { courseId, name: "Full cohort", capacity: 1 });
    assert.ok(cohortResult.kind === "ok");
    const cohortId = cohortResult.id;

    const [resultA, resultB] = await Promise.all([
      enrollStudent(adminId, org.id, { userId: studentA, courseId, cohortId, source: "ORGANIZATION" }),
      enrollStudent(adminId, org.id, { userId: studentB, courseId, cohortId, source: "ORGANIZATION" }),
    ]);
    const outcomes = [resultA.kind, resultB.kind].sort();
    assert.deepEqual(outcomes, ["cohort_full", "ok"], `expected exactly one success, got ${JSON.stringify(outcomes)}`);

    const count = await client.query("select count(*)::int as n from cohort_membership where cohort_id = $1", [cohortId]);
    assert.equal(count.rows[0].n, 1);

    await cleanup(client, [org.id], [adminId, ownerId, studentA, studentB], [courseId]);
  });
});

test("teacher-course assignment: requires ACTIVE TEACHER persona; IDOR — assigned-to-course-A teacher has no course-B access", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { assignTeacher } = await import("../../src/server/services/teacher-assignments");
    const { isTeacherAssignedToCourse } = await import("../../src/server/queries/teacher-assignments");

    const adminId = await seedUser(client);
    const teacherId = await seedUserWithPersona(client, "TEACHER");
    const notTeacher = await seedUser(client);
    const courseA = await seedCourse(client);
    const courseB = await seedCourse(client);

    assert.equal((await assignTeacher(adminId, notTeacher, courseA, null)).kind, "invalid_persona");

    const assigned = await assignTeacher(adminId, teacherId, courseA, null);
    assert.equal(assigned.kind, "ok");

    assert.equal(await isTeacherAssignedToCourse(teacherId, courseA), true);
    assert.equal(await isTeacherAssignedToCourse(teacherId, courseB), false);

    const audit = await client.query(`select action from audit_logs where entity_type = 'teacher_course_assignment'`);
    assert.ok(audit.rows.some((r) => r.action === "relationship.teacherAssignment.create"));

    await cleanup(client, [], [adminId, teacherId, notTeacher], [courseA, courseB]);
  });
});

test("teacher-course assignment: at most one ACTIVE assignment per teacher/course; ending preserves history", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { assignTeacher, endTeacherAssignment } = await import("../../src/server/services/teacher-assignments");

    const adminId = await seedUser(client);
    const teacherId = await seedUserWithPersona(client, "TEACHER");
    const courseId = await seedCourse(client);

    const first = await assignTeacher(adminId, teacherId, courseId, null);
    assert.ok(first.kind === "ok");

    await assert.rejects(
      client.query(
        `insert into teacher_course_assignment (id, teacher_user_id, course_id, status, created_by, created_at, updated_at)
         values ($1, $2, $3, 'ACTIVE', $4, now(), now())`,
        [crypto.randomUUID(), teacherId, courseId, adminId],
      ),
      /duplicate key|unique/i,
    );

    await endTeacherAssignment(adminId, first.id);
    const second = await assignTeacher(adminId, teacherId, courseId, null);
    assert.ok(second.kind === "ok");
    assert.notEqual(second.id, first.id);

    const rows = await client.query("select status from teacher_course_assignment where teacher_user_id = $1 and course_id = $2", [teacherId, courseId]);
    assert.equal(rows.rowCount, 2, "history is preserved, not overwritten");

    await cleanup(client, [], [adminId, teacherId], [courseId]);
  });
});

test("enrollContact: ACCEPTED admission alone does not enroll — a linked user account is also required", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAdmission, decideAdmission } = await import("../../src/server/services/admissions");
    const { enrollContact } = await import("../../src/server/services/enrollments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Enroll Org", slug: `lms-enroll-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");
    const courseId = await seedCourse(client);

    // ACCEPTED admission, but contact never linked to a user account.
    const created = await createAdmission(adminId, "OWNER", org.id, { contactId: contact.id });
    assert.ok(created.kind === "ok");
    assert.equal((await decideAdmission(adminId, "OWNER", org.id, created.id, "ACCEPTED")).kind, "ok");

    const result = await enrollContact(adminId, org.id, { contactId: contact.id, courseId });
    assert.equal(result.kind, "invalid_contact");

    const count = await client.query("select count(*)::int as n from enrollments where course_id = $1", [courseId]);
    assert.equal(count.rows[0].n, 0);

    await cleanup(client, [org.id], [adminId, ownerId], [courseId]);
  });
});

test("enrollContact: linked student with ACCEPTED admission can be explicitly enrolled with source ORGANIZATION and a CRM COURSE_ENROLLED activity", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAdmission, decideAdmission } = await import("../../src/server/services/admissions");
    const { linkCrmContactUser } = await import("../../src/server/services/crm");
    const { enrollContact } = await import("../../src/server/services/enrollments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Enroll Org", slug: `lms-enroll-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");
    const courseId = await seedCourse(client);
    const studentId = await seedUserWithPersona(client, "STUDENT");

    const created = await createAdmission(adminId, "OWNER", org.id, { contactId: contact.id });
    assert.ok(created.kind === "ok");
    assert.equal((await decideAdmission(adminId, "OWNER", org.id, created.id, "ACCEPTED")).kind, "ok");
    assert.equal((await linkCrmContactUser(adminId, org.id, contact.id, studentId)).kind, "ok");

    const result = await enrollContact(adminId, org.id, { contactId: contact.id, courseId });
    assert.ok(result.kind === "ok" && result.created);

    const row = await client.query("select source from enrollments where user_id = $1 and course_id = $2", [studentId, courseId]);
    assert.equal(row.rows[0]?.source, "ORGANIZATION");

    const activity = await client.query("select type from crm_contact_activity where contact_id = $1 and type = 'COURSE_ENROLLED'", [contact.id]);
    assert.equal(activity.rows.length, 1);

    await cleanup(client, [org.id], [adminId, ownerId, studentId], [courseId]);
  });
});

test("existing purchase flow regression: grantOrder still creates a PAYMENT-sourced enrollment and getLearningCourse access", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { markMockOrderPaid } = await import("../../src/server/services/checkout");
    const { getLearningCourse } = await import("../../src/server/queries/account");

    const userId = await seedUser(client);
    const courseId = await seedCourse(client);
    const [{ slug }] = (await client.query("select slug from courses where id = $1", [courseId])).rows;

    const orderId = crypto.randomUUID();
    await client.query(
      `insert into orders (id, user_id, item_type, item_id, item_label, amount_millimes, status, provider, idempotency_key, created_at, updated_at)
       values ($1, $2, 'course', $3, 'Course', 0, 'pending', 'mock', $4, now(), now())`,
      [orderId, userId, courseId, crypto.randomUUID()],
    );
    await client.query(
      `insert into payments (id, order_id, provider, status, amount_millimes, created_at, updated_at)
       values ($1, $2, 'mock', 'pending', 0, now(), now())`,
      [crypto.randomUUID(), orderId],
    );

    await markMockOrderPaid(orderId);

    const course = await getLearningCourse(userId, slug);
    assert.ok(course, "existing payment-based enrollment must still grant course access unmodified");
    assert.equal(course!.enrollment.source, "PAYMENT");

    await client.query("delete from payments where order_id = $1", [orderId]);
    await client.query("delete from orders where id = $1", [orderId]);
    await cleanup(client, [], [userId], [courseId]);
  });
});
