import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import { db } from "@/server/db";
import { eq, and } from "drizzle-orm";
import {
  aiConversation,
  crmContact,
  crmContactNote,
  crmContactTag,
  crmTag,
  courses,
  enrollments,
  organization,
  organizationMembership,
  parentStudentLink,
  personaMembership,
  teacherCourseAssignment,
  user as userTable,
} from "@/server/db/schema";
import { getToolRegistry } from "@/server/tools/registry";
import { createCrmNoteTool, addCrmTagTool } from "@/server/tools/definitions/low-risk-tools";
import { enrollStudentTool } from "@/server/tools/definitions/business-expansion";
import { getStudentProgressTool } from "@/server/tools/definitions/read-expansion";
import { executeLowRiskWriteTool } from "@/server/tools/execution";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);
if (!url) {
  throw new Error("A test database URL is required (TEST_DATABASE_URL or a non-production default)");
}
process.env.TEST_DATABASE_URL = url;

function uuid() {
  return crypto.randomUUID();
}

async function seedUser(client: Client, role = "USER", name = "Tool Test") {
  const id = uuid();
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, locale, created_at, updated_at)
     values ($1, $2, $3, true, $4, 'learner', 'fr', now(), now())`,
    [id, name, `${name.replace(/\s+/g, "-").toLowerCase()}-${id}@example.test`, role],
  );
  return id;
}

async function seedOrg(client: Client) {
  const id = uuid();
  await client.query(
    `insert into organization (id, name, slug, status, created_at, updated_at) values ($1, 'Org', $2, 'ACTIVE', now(), now())`,
    [id, `org-${uuid()}`],
  );
  return id;
}

async function seedMembership(client: Client, orgId: string, userId: string, role = "STAFF") {
  await client.query(
    `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
     values ($1, $2, $3, $4, 'ACTIVE', now(), now())`,
    [uuid(), orgId, userId, role],
  );
}

async function seedContact(client: Client, orgId: string, createdBy: string) {
  const id = uuid();
  await client.query(
    `insert into crm_contact (id, organization_id, first_name, last_name, created_by_user_id, status, created_at, updated_at)
     values ($1, $2, 'First', 'Last', $3, 'ACTIVE', now(), now())`,
    [id, orgId, createdBy],
  );
  return id;
}

async function seedCourse(client: Client) {
  const id = uuid();
  await client.query(
    `insert into courses (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
       category, level, mode, trainer_name, duration_minutes, price_millimes, objectives, published, created_at, updated_at)
     values ($1, $2, 'Cours FR', 'Course AR', 'sum fr', 'sum ar', 'desc fr', 'desc ar',
       'inclusion', 'beginner', 'online', 'Trainer', 60, 0, '{"fr":[],"ar":[]}', false, now(), now())`,
    [id, `course-${uuid()}`],
  );
  return id;
}

async function seedPersona(client: Client, userId: string, persona: string) {
  await client.query(
    `insert into persona_membership (id, user_id, persona, status, is_primary, created_at, updated_at)
     values ($1, $2, $3, 'ACTIVE', true, now(), now())`,
    [uuid(), userId, persona],
  );
}

async function seedConversation(client: Client, userId: string) {
  const id = uuid();
  await client.query(
    `insert into ai_conversation (id, user_id, title, status, created_at, updated_at)
     values ($1, $2, 'Test', 'ACTIVE', now(), now())`,
    [id, userId],
  );
  return id;
}

test("10C.1: unauthorized actor denied - no org role means CRM/enroll tools are not offered", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const userA = await seedUser(client);
    const tools = await getToolRegistry().getAllowedTools({ userId: userA, locale: "fr", requestId: uuid(), organizationId: null });
    const names = tools.map((t) => t.name);
    assert.equal(names.includes("create_crm_note"), false);
    assert.equal(names.includes("add_crm_tag"), false);
    assert.equal(names.includes("enroll_student"), false);
    assert.ok(names.includes("get_my_enrollments"));
    assert.ok(names.includes("get_my_courses"));
  } finally {
    await client.end();
  }
});

test("10C.2: cross-org CRM note denied", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const userA = await seedUser(client);
    const orgA = await seedOrg(client);
    const orgB = await seedOrg(client);
    await seedMembership(client, orgA, userA);
    const contactB = await seedContact(client, orgB, userA);

    const tools = await getToolRegistry().getAllowedTools({ userId: userA, locale: "fr", requestId: uuid(), organizationId: orgA });
    const noteTool = tools.find((t) => t.name === "create_crm_note");
    assert.ok(noteTool, "STAFF in org A must be offered create_crm_note");

    await assert.rejects(
      noteTool.execute({ contactId: contactB, body: "nope" }, { userId: userA, locale: "fr", requestId: uuid(), organizationId: orgA }),
      /not_found/
    );

    const notes = await client.query('select count(*)::int as n from crm_contact_note where contact_id = $1', [contactB]);
    assert.equal(notes.rows[0].n, 0);
  } finally {
    await client.end();
  }
});

test("10C.3: CRM note author comes from the server actor, never the input", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const userA = await seedUser(client);
    const orgA = await seedOrg(client);
    await seedMembership(client, orgA, userA);
    const contactA = await seedContact(client, orgA, userA);

    const input = { contactId: contactA, body: "hello from AI" };
    const result = await executeLowRiskWriteTool(createCrmNoteTool, {
      userId: userA,
      locale: "fr",
      requestId: uuid(),
      organizationId: orgA,
      platformRole: "USER",
      organizationRole: "STAFF",
    }, input);

    assert.ok(result.success);
    const [note] = await db
      .select({ authorUserId: crmContactNote.authorUserId })
      .from(crmContactNote)
      .where(eq(crmContactNote.contactId, contactA))
      .limit(1);
    assert.equal(note.authorUserId, userA);
  } finally {
    await client.end();
  }
});

test("10C.4: cross-org tag mutation denied", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const userA = await seedUser(client);
    const orgA = await seedOrg(client);
    const orgB = await seedOrg(client);
    await seedMembership(client, orgA, userA);
    const contactA = await seedContact(client, orgA, userA);
    const tagB = uuid();
    await client.query(
      `insert into crm_tag (id, organization_id, name, created_at) values ($1, $2, $3, now())`,
      [tagB, orgB, `tag-${uuid()}`],
    );

    const result = await executeLowRiskWriteTool(addCrmTagTool, {
      userId: userA,
      locale: "fr",
      requestId: uuid(),
      organizationId: orgA,
      platformRole: "USER",
      organizationRole: "STAFF",
    }, { contactId: contactA, tagId: tagB });

    assert.equal(result.success, false);
    const links = await client.query(
      "select count(*)::int as n from crm_contact_tag where contact_id = $1 and tag_id = $2",
      [contactA, tagB],
    );
    assert.equal(links.rows[0].n, 0);
  } finally {
    await client.end();
  }
});

test("10C.5: get_student_progress relationship isolation", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const student = await seedUser(client);
    const stranger = await seedUser(client);
    const parent = await seedUser(client);
    const teacher = await seedUser(client);
    const orgA = await seedOrg(client);
    await seedMembership(client, orgA, parent);
    await seedMembership(client, orgA, teacher);
    const courseA = await seedCourse(client);
    const courseB = await seedCourse(client);

    await seedPersona(client, student, "STUDENT");
    await client.query(
      `insert into enrollments (id, user_id, course_id, status, progress_percent, source, enrolled_at) values ($1,$2,$3,'active',40,'ORGANIZATION',now())`,
      [uuid(), student, courseA],
    );
    await client.query(
      `insert into enrollments (id, user_id, course_id, status, progress_percent, source, enrolled_at) values ($1,$2,$3,'active',70,'ORGANIZATION',now())`,
      [uuid(), student, courseB],
    );

    await client.query(
      `insert into parent_student_link (id, parent_user_id, student_user_id, relationship_type, status, created_by, created_at, updated_at) values ($1,$2,$3,'MOTHER','ACTIVE',$2,now(),now())`,
      [uuid(), parent, student],
    );
    await client.query(
      `insert into teacher_course_assignment (id, teacher_user_id, course_id, organization_id, status, created_by, created_at, updated_at) values ($1,$2,$3,$4,'ACTIVE',$5,now(),now())`,
      [uuid(), teacher, courseA, orgA, teacher],
    );

    const authCtx = { userId: parent, locale: "fr" as const, requestId: uuid(), organizationId: orgA };
    const parentTools = await getToolRegistry().getAllowedTools(authCtx);
    const progressTool = parentTools.find((t) => t.name === "get_student_progress");
    assert.ok(progressTool);
    const parentResult = (await progressTool.execute({ userId: student }, { ...authCtx, requestId: uuid() })) as { courses: Array<{ courseId: string }> };
    assert.equal(parentResult.courses.length, 2, "parent sees both courses");

    const strangerTools = await getToolRegistry().getAllowedTools({ userId: stranger, locale: "fr", requestId: uuid(), organizationId: orgA });
    const strangerProgress = strangerTools.find((t) => t.name === "get_student_progress");
    assert.ok(strangerProgress, "stranger can still see the tool");
    await assert.rejects(strangerProgress.execute({ userId: student }, { userId: stranger, locale: "fr", requestId: uuid(), organizationId: orgA }), /No self\/relationship/);

    const teacherAuth = { userId: teacher, locale: "fr" as const, requestId: uuid(), organizationId: orgA };
    const teacherTools = await getToolRegistry().getAllowedTools(teacherAuth);
    const teacherProgress = teacherTools.find((t) => t.name === "get_student_progress");
    assert.ok(teacherProgress, "teacher must be offered get_student_progress");
    const teacherResult = (await teacherProgress.execute({ userId: student }, { ...teacherAuth, requestId: uuid() })) as { courses: Array<{ courseId: string }> };
    assert.equal(teacherResult.courses.length, 1, "teacher sees only the course they teach");
    assert.equal(teacherResult.courses[0].courseId, courseA);

    await db.delete(enrollments).where(eq(enrollments.userId, student));
    await db.delete(teacherCourseAssignment).where(eq(teacherCourseAssignment.teacherUserId, teacher));
    await db.delete(parentStudentLink).where(eq(parentStudentLink.parentUserId, parent));
    await db.delete(personaMembership).where(eq(personaMembership.userId, student));
    await db.delete(courses).where(eq(courses.id, courseA));
    await db.delete(courses).where(eq(courses.id, courseB));
  } finally {
    await client.end();
  }
});

test("10C.6: enroll_student requires BUSINESS_WRITE confirmation", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const staff = await seedUser(client);
    const student = await seedUser(client);
    const orgA = await seedOrg(client);
    await seedMembership(client, orgA, staff, "MANAGER");
    await seedPersona(client, student, "STUDENT");
    const courseA = await seedCourse(client);
    const conversation = await seedConversation(client, staff);

    const proposal = await getToolRegistry().proposeTool(
      "enroll_student",
      { userId: staff, locale: "fr", requestId: uuid(), organizationId: orgA },
      { userId: student, courseId: courseA },
      conversation,
    );
    assert.equal(proposal.requiresConfirmation, true);
    assert.ok(proposal.executionId);

    await db.delete(aiConversation).where(eq(aiConversation.id, conversation));
  } finally {
    await client.end();
  }
});

test("10C.7: enroll_student cannot execute before confirmation", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const staff = await seedUser(client);
    const student = await seedUser(client);
    const orgA = await seedOrg(client);
    await seedMembership(client, orgA, staff, "MANAGER");
    await seedPersona(client, student, "STUDENT");
    const courseA = await seedCourse(client);
    const conversation = await seedConversation(client, staff);

    const proposal = await getToolRegistry().proposeTool(
      "enroll_student",
      { userId: staff, locale: "fr", requestId: uuid(), organizationId: orgA },
      { userId: student, courseId: courseA },
      conversation,
    );

    await assert.rejects(
      getToolRegistry().confirmAndExecuteTool(
        "enroll_student",
        { userId: staff, locale: "fr", requestId: uuid(), organizationId: orgA },
        crypto.randomUUID(),
        { userId: student, courseId: courseA },
      ),
      /not found|access denied/
    );

    const rows = await client.query("select count(*)::int as n from enrollments where user_id = $1 and course_id = $2", [student, courseA]);
    assert.equal(rows.rows[0].n, 0);

    await db.delete(aiConversation).where(eq(aiConversation.id, conversation));
  } finally {
    await client.end();
  }
});

test("10C.8: duplicate confirmation cannot duplicate enrollment", async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const staff = await seedUser(client);
    const student = await seedUser(client);
    const orgA = await seedOrg(client);
    await seedMembership(client, orgA, staff, "MANAGER");
    await seedPersona(client, student, "STUDENT");
    const courseA = await seedCourse(client);
    const conversation = await seedConversation(client, staff);

    const proposal = await getToolRegistry().proposeTool(
      "enroll_student",
      { userId: staff, locale: "fr", requestId: uuid(), organizationId: orgA },
      { userId: student, courseId: courseA },
      conversation,
    );

    const first = await getToolRegistry().confirmAndExecuteTool(
      "enroll_student",
      { userId: staff, locale: "fr", requestId: uuid(), organizationId: orgA },
      proposal.executionId,
      { userId: student, courseId: courseA },
    );
    assert.equal(first.success, true);

    await assert.rejects(
      getToolRegistry().confirmAndExecuteTool(
        "enroll_student",
        { userId: staff, locale: "fr", requestId: uuid(), organizationId: orgA },
        proposal.executionId,
        { userId: student, courseId: courseA },
      ),
      /cannot be confirmed|not found|access denied/
    );

    const rows = await client.query("select count(*)::int as n from enrollments where user_id = $1 and course_id = $2", [student, courseA]);
    assert.equal(rows.rows[0].n, 1, "exactly one enrollment row despite duplicate confirmation");

    await db.delete(enrollments).where(eq(enrollments.userId, student));
    await db.delete(personaMembership).where(eq(personaMembership.userId, student));
    await db.delete(courses).where(eq(courses.id, courseA));
    await db.delete(aiConversation).where(eq(aiConversation.id, conversation));
  } finally {
    await client.end();
  }
});

test("10C.9: new tools reject model-supplied actor/role fields", async () => {
  assert.throws(() => createCrmNoteTool.inputSchema.parse({ contactId: uuid(), body: "x", actorUserId: "attacker", role: "SUPER_ADMIN" }));
  assert.throws(() => addCrmTagTool.inputSchema.parse({ contactId: uuid(), tagId: uuid(), organizationId: "other-org" }));
  assert.throws(() => enrollStudentTool.inputSchema.parse({ userId: uuid(), courseId: uuid(), source: "ADMIN", role: "ADMIN" }));
});

test("10C.10: strict schemas reject unknown extra fields", async () => {
  assert.throws(() => getStudentProgressTool.inputSchema.parse({ userId: uuid(), adminOverride: true }));
  assert.throws(() => enrollStudentTool.inputSchema.parse({ userId: uuid(), courseId: uuid(), cohortId: uuid(), unexpected: 1 }));
  assert.throws(() => createCrmNoteTool.inputSchema.parse({ contactId: uuid(), body: "x", noteAuthor: uuid() }));
});