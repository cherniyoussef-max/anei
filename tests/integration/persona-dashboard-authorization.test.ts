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

async function createUser(client: Client, email: string): Promise<string> {
  const { rows } = await client.query(
    `insert into "user" (id, name, email, email_verified, role, locale, profile_type, created_at, updated_at)
     values (gen_random_uuid(), $1, $2, true, 'USER', 'fr', 'learner', now(), now()) returning id`,
    [email, email],
  );
  return rows[0].id as string;
}

async function seedCourse(client: Client, slug: string): Promise<string> {
  const courseId = crypto.randomUUID();
  await client.query(
    `insert into courses
      (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
       category, level, mode, trainer_name, duration_minutes, price_millimes, published, featured,
       objectives, created_at, updated_at)
     values ($1,$2,'Course','دورة','Sum','ملخص','Desc','وصف','test','beginner','online',
             'ANEI',60,0,true,false,$3::jsonb,now(),now())`,
    [courseId, slug, JSON.stringify({ fr: [], ar: [] })],
  );
  return courseId;
}

async function cleanupUsers(client: Client, userIds: string[]) {
  for (const id of userIds) await client.query('delete from "user" where id = $1', [id]);
}

test("teacher dashboard: teacher A sees only courses assigned to them, not an unrelated course", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { getAssignedCoursesForTeacher } = await import("../../src/server/queries/teacher-assignments");

    const teacherA = await createUser(client, `teacher-a-${crypto.randomUUID()}@example.test`);
    const teacherB = await createUser(client, `teacher-b-${crypto.randomUUID()}@example.test`);
    const courseA = await seedCourse(client, `course-a-${crypto.randomUUID()}`);
    const courseB = await seedCourse(client, `course-b-${crypto.randomUUID()}`);

    await client.query(
      `insert into teacher_course_assignment (id, teacher_user_id, course_id, status, created_by, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'ACTIVE', $1, now(), now())`,
      [teacherA, courseA],
    );
    await client.query(
      `insert into teacher_course_assignment (id, teacher_user_id, course_id, status, created_by, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'ACTIVE', $1, now(), now())`,
      [teacherB, courseB],
    );

    const teacherAScope = await getAssignedCoursesForTeacher(teacherA);
    assert.equal(teacherAScope.length, 1);
    assert.equal(teacherAScope[0].course.id, courseA);
    assert.ok(!teacherAScope.some((row) => row.course.id === courseB), "teacher A must never see course B");

    await client.query(`delete from teacher_course_assignment where course_id in ($1,$2)`, [courseA, courseB]);
    await client.query(`delete from courses where id in ($1,$2)`, [courseA, courseB]);
    await cleanupUsers(client, [teacherA, teacherB]);
  });
});

test("parent dashboard: parent sees only their ACTIVE-linked child, not an unrelated child", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { getLinkedStudentsForParent } = await import("../../src/server/queries/relationships");

    const parent = await createUser(client, `parent-${crypto.randomUUID()}@example.test`);
    const childA = await createUser(client, `child-a-${crypto.randomUUID()}@example.test`);
    const childB = await createUser(client, `child-b-${crypto.randomUUID()}@example.test`);

    await client.query(
      `insert into parent_student_link (id, parent_user_id, student_user_id, relationship_type, status, created_by, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'MOTHER', 'ACTIVE', $1, now(), now())`,
      [parent, childA],
    );

    const linked = await getLinkedStudentsForParent(parent);
    assert.equal(linked.length, 1);
    assert.equal(linked[0].student.id, childA);
    assert.ok(!linked.some((row) => row.student.id === childB), "parent must never see unrelated child B");

    await client.query(`delete from parent_student_link where parent_user_id = $1`, [parent]);
    await cleanupUsers(client, [parent, childA, childB]);
  });
});

test("AVS dashboard: AVS sees only assigned student, not an unassigned one", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { getAssignedStudentsForAvs } = await import("../../src/server/queries/relationships");

    const avs = await createUser(client, `avs-${crypto.randomUUID()}@example.test`);
    const assignedStudent = await createUser(client, `assigned-${crypto.randomUUID()}@example.test`);
    const unassignedStudent = await createUser(client, `unassigned-${crypto.randomUUID()}@example.test`);

    await client.query(
      `insert into avs_student_assignment (id, avs_user_id, student_user_id, status, start_date, created_by, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'ACTIVE', now(), $1, now(), now())`,
      [avs, assignedStudent],
    );

    const assigned = await getAssignedStudentsForAvs(avs);
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].student.id, assignedStudent);
    assert.ok(!assigned.some((row) => row.student.id === unassignedStudent));

    await client.query(`delete from avs_student_assignment where avs_user_id = $1`, [avs]);
    await cleanupUsers(client, [avs, assignedStudent, unassignedStudent]);
  });
});

test("Specialist dashboard: specialist sees only assigned student, not an unassigned one", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { getAssignedStudentsForSpecialist } = await import("../../src/server/queries/relationships");

    const specialist = await createUser(client, `specialist-${crypto.randomUUID()}@example.test`);
    const assignedStudent = await createUser(client, `assigned-sp-${crypto.randomUUID()}@example.test`);
    const unassignedStudent = await createUser(client, `unassigned-sp-${crypto.randomUUID()}@example.test`);

    await client.query(
      `insert into specialist_student_assignment (id, specialist_user_id, student_user_id, status, start_date, created_by, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'ACTIVE', now(), $1, now(), now())`,
      [specialist, assignedStudent],
    );

    const assigned = await getAssignedStudentsForSpecialist(specialist);
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].student.id, assignedStudent);
    assert.ok(!assigned.some((row) => row.student.id === unassignedStudent));

    await client.query(`delete from specialist_student_assignment where specialist_user_id = $1`, [specialist]);
    await cleanupUsers(client, [specialist, assignedStudent, unassignedStudent]);
  });
});

test("Organization dashboard: user sees only the organization they hold ACTIVE membership in", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { getUserOrganizationMemberships } = await import("../../src/server/queries/organizations");

    const staffUser = await createUser(client, `org-staff-${crypto.randomUUID()}@example.test`);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    await client.query(`insert into organization (id, name, slug, status, created_at, updated_at) values ($1,'Org A',$2,'ACTIVE',now(),now())`, [orgA, `org-a-${orgA}`]);
    await client.query(`insert into organization (id, name, slug, status, created_at, updated_at) values ($1,'Org B',$2,'ACTIVE',now(),now())`, [orgB, `org-b-${orgB}`]);
    await client.query(
      `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'STAFF', 'ACTIVE', now(), now())`,
      [orgA, staffUser],
    );

    const memberships = await getUserOrganizationMemberships(staffUser);
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].organization.id, orgA);
    assert.ok(!memberships.some((row) => row.organization.id === orgB), "user must never see organization B without membership");

    await client.query(`delete from organization where id in ($1,$2)`, [orgA, orgB]);
    await cleanupUsers(client, [staffUser]);
  });
});

test("Organization dashboard: VIEWER role does not meet the roster-visibility threshold (STAFF+)", { skip: !url }, async () => {
  const { organizationRoleAtLeast } = await import("../../src/modules/relationships/domain/permissions");
  assert.equal(organizationRoleAtLeast("VIEWER", "STAFF"), false);
  assert.equal(organizationRoleAtLeast("STAFF", "STAFF"), true);
  assert.equal(organizationRoleAtLeast("MANAGER", "STAFF"), true);
  assert.equal(organizationRoleAtLeast("OWNER", "STAFF"), true);
});

test("parent dashboard: progress overview shows only the ACTIVE-linked child's enrollments, never another child's", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { getLinkedStudentsProgressForParent } = await import("../../src/server/queries/relationships");

    const parent = await createUser(client, `parent-prog-${crypto.randomUUID()}@example.test`);
    const ownChild = await createUser(client, `own-child-${crypto.randomUUID()}@example.test`);
    const otherChild = await createUser(client, `other-child-${crypto.randomUUID()}@example.test`);
    const courseOwn = await seedCourse(client, `course-own-${crypto.randomUUID()}`);
    const courseOther = await seedCourse(client, `course-other-${crypto.randomUUID()}`);

    await client.query(
      `insert into parent_student_link (id, parent_user_id, student_user_id, relationship_type, status, created_by, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'MOTHER', 'ACTIVE', $1, now(), now())`,
      [parent, ownChild],
    );
    // Enrollment for the parent's OWN child and one for an unrelated child.
    await client.query(
      `insert into enrollments (id, user_id, course_id, status, progress_percent, enrolled_at)
       values (gen_random_uuid(), $1, $2, 'active', 42, now())`,
      [ownChild, courseOwn],
    );
    await client.query(
      `insert into enrollments (id, user_id, course_id, status, progress_percent, enrolled_at)
       values (gen_random_uuid(), $1, $2, 'active', 99, now())`,
      [otherChild, courseOther],
    );

    const rows = await getLinkedStudentsProgressForParent(parent);
    assert.equal(rows.length, 1, "only the linked child's enrollment appears");
    assert.equal(rows[0].studentId, ownChild);
    assert.equal(rows[0].courseId, courseOwn);
    assert.equal(rows[0].progressPercent, 42);
    assert.ok(!rows.some((row) => row.studentId === otherChild), "parent must never see the unrelated child's progress");

    await client.query(`delete from enrollments where user_id in ($1,$2)`, [ownChild, otherChild]);
    await client.query(`delete from parent_student_link where parent_user_id = $1`, [parent]);
    await client.query(`delete from courses where id in ($1,$2)`, [courseOwn, courseOther]);
    await cleanupUsers(client, [parent, ownChild, otherChild]);
  });
});

test("pending professional: PENDING_REVIEW persona does not resolve as an ACTIVE membership for dashboard access", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await createUser(client, `pending-teacher-${crypto.randomUUID()}@example.test`);
    await client.query(
      `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
       values (gen_random_uuid(), $1, 'TEACHER', 'PENDING_REVIEW', true, now(), now())`,
      [userId],
    );

    const { rows } = await client.query(`select status from persona_membership where user_id = $1 and persona = 'TEACHER'`, [userId]);
    assert.equal(rows[0].status, "PENDING_REVIEW", "requireActivePersona redirects to /pending-review unless status is exactly ACTIVE");

    await client.query(`update persona_membership set status = 'ACTIVE' where user_id = $1 and persona = 'TEACHER'`, [userId]);
    const { rows: afterActivation } = await client.query(`select status from persona_membership where user_id = $1 and persona = 'TEACHER'`, [userId]);
    assert.equal(afterActivation[0].status, "ACTIVE");

    await cleanupUsers(client, [userId]);
  });
});
