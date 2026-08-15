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
  const email = `apt-${userId}@example.test`;
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, created_at, updated_at)
     values ($1, 'Test User', $2, true, 'USER', 'learner', now(), now())`,
    [userId, email],
  );
  return userId;
}

async function seedContact(adminId: string, orgId: string, firstName: string, lastName: string) {
  const { createCrmContact } = await import("../../src/server/services/crm");
  const result = await createCrmContact(adminId, orgId, { firstName, lastName });
  assert.ok(result.kind === "ok");
  return result;
}

async function cleanup(client: Client, orgIds: string[], userIds: string[]) {
  await client.query("delete from appointment_event where appointment_id in (select id from appointment where organization_id = any($1))", [orgIds]);
  await client.query("delete from appointment where organization_id = any($1)", [orgIds]);
  await client.query("delete from crm_contact_activity where contact_id in (select id from crm_contact where organization_id = any($1))", [orgIds]);
  await client.query("delete from crm_contact where organization_id = any($1)", [orgIds]);
  await client.query("delete from organization where id = any($1)", [orgIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
}

function dayStart(daysFromNow = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(9, 0, 0, 0);
  return date;
}

test("createAppointment: creates an appointment for a contact without any linked user, writes CREATED event + activity + audit", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { createAppointment } = await import("../../src/server/services/appointments");
    const { getAppointment } = await import("../../src/server/queries/admission");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const staffId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    await addOrganizationMember(adminId, org.id, staffId, "STAFF");

    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");
    const start = dayStart(2);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const result = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contact.id,
      assignedToUserId: staffId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: end,
    });
    assert.equal(result.kind, "ok");
    assert.ok(result.kind === "ok");

    const detail = await getAppointment(org.id, result.id);
    assert.equal(detail?.appointment.status, "SCHEDULED");
    assert.equal(detail?.appointment.contactId, contact.id);
    assert.equal(detail?.events[0]?.eventType, "CREATED");

    const audit = await client.query(`select action from audit_logs where entity_type = 'appointment' and entity_id = $1`, [result.id]);
    assert.equal(audit.rows[0]?.action, "crm.appointment.create");

    await cleanup(client, [org.id], [adminId, ownerId, staffId]);
  });
});

test("createAppointment: rejects an assignee who is not an ACTIVE member of the organization", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment } = await import("../../src/server/services/appointments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const outsiderId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const start = dayStart(2);
    const result = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contact.id,
      assignedToUserId: outsiderId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60 * 1000),
    });
    assert.equal(result.kind, "invalid_assignee");

    await cleanup(client, [org.id], [adminId, ownerId, outsiderId]);
  });
});

test("createAppointment: rejects a contact from another organization (cross-org reference)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment } = await import("../../src/server/services/appointments");

    const adminId = await seedUser(client);
    const ownerAId = await seedUser(client);
    const ownerBId = await seedUser(client);
    const orgA = await createOrganization(adminId, { name: "Org A", slug: `apt-a-${crypto.randomUUID()}` }, ownerAId);
    const orgB = await createOrganization(adminId, { name: "Org B", slug: `apt-b-${crypto.randomUUID()}` }, ownerBId);
    const contactA = await seedContact(adminId, orgA.id, "Aya", "Prospect");

    const start = dayStart(2);
    const result = await createAppointment(adminId, "OWNER", orgB.id, {
      contactId: contactA.id,
      assignedToUserId: ownerBId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60 * 1000),
    });
    assert.equal(result.kind, "invalid_contact");

    await cleanup(client, [orgA.id, orgB.id], [adminId, ownerAId, ownerBId]);
  });
});

test("createAppointment: rejects endAt <= startAt (INVALID_TIME_RANGE)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment } = await import("../../src/server/services/appointments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const start = dayStart(2);
    const result = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contact.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: new Date(start.getTime() - 60 * 60 * 1000),
    });
    assert.equal(result.kind, "invalid_time_range");

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("appointment double-booking is rejected for the same staff member with an overlapping slot", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment } = await import("../../src/server/services/appointments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contactA = await seedContact(adminId, org.id, "Aya", "Prospect");
    const contactB = await seedContact(adminId, org.id, "Bilel", "Prospect");

    const start = dayStart(2);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const first = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contactA.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: end,
    });
    assert.equal(first.kind, "ok");

    // Overlapping: 1h into the first slot.
    const overlap = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contactB.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: new Date(start.getTime() + 60 * 60 * 1000),
      endAt: new Date(end.getTime() + 60 * 60 * 1000),
    });
    assert.equal(overlap.kind, "slot_conflict");

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("appointment double-booking is allowed for a different staff member at the same time", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization, addOrganizationMember } = await import("../../src/server/services/organizations");
    const { createAppointment } = await import("../../src/server/services/appointments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const staffId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    await addOrganizationMember(adminId, org.id, staffId, "STAFF");
    const contactA = await seedContact(adminId, org.id, "Aya", "Prospect");
    const contactB = await seedContact(adminId, org.id, "Bilel", "Prospect");

    const start = dayStart(2);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    await createAppointment(adminId, "OWNER", org.id, {
      contactId: contactA.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: end,
    });
    const second = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contactB.id,
      assignedToUserId: staffId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: end,
    });
    assert.equal(second.kind, "ok");

    await cleanup(client, [org.id], [adminId, ownerId, staffId]);
  });
});

test("a cancelled appointment frees its slot for a new booking", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment, setAppointmentStatus } = await import("../../src/server/services/appointments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contactA = await seedContact(adminId, org.id, "Aya", "Prospect");
    const contactB = await seedContact(adminId, org.id, "Bilel", "Prospect");

    const start = dayStart(2);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const first = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contactA.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: end,
    });
    assert.equal(first.kind, "ok");

    const cancelled = await setAppointmentStatus(adminId, "OWNER", org.id, first.id, "CANCELLED");
    assert.equal(cancelled.kind, "ok");

    const rebook = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contactB.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: end,
    });
    assert.equal(rebook.kind, "ok");

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("appointment state machine: SCHEDULED -> CONFIRMED -> COMPLETED is valid; COMPLETED cannot be cancelled", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment, setAppointmentStatus } = await import("../../src/server/services/appointments");
    const { getAppointment } = await import("../../src/server/queries/admission");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const start = dayStart(2);
    const created = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contact.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60 * 1000),
    });
    assert.equal(created.kind, "ok");

    assert.equal((await setAppointmentStatus(adminId, "OWNER", org.id, created.id, "CONFIRMED")).kind, "ok");
    assert.equal((await setAppointmentStatus(adminId, "OWNER", org.id, created.id, "COMPLETED")).kind, "ok");
    assert.equal((await setAppointmentStatus(adminId, "OWNER", org.id, created.id, "CANCELLED")).kind, "invalid_transition");

    const detail = await getAppointment(org.id, created.id);
    assert.equal(detail?.appointment.status, "COMPLETED");
    assert.notEqual(detail?.appointment.completedAt, null);

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("rescheduleAppointment: updates the window and records a RESCHEDULED event; terminal states cannot move", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment, rescheduleAppointment, setAppointmentStatus } = await import("../../src/server/services/appointments");
    const { getAppointment } = await import("../../src/server/queries/admission");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const start = dayStart(2);
    const created = await createAppointment(adminId, "OWNER", org.id, {
      contactId: contact.id,
      assignedToUserId: ownerId,
      type: "ASSESSMENT",
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60 * 1000),
    });
    assert.equal(created.kind, "ok");

    const newStart = dayStart(5);
    const moved = await rescheduleAppointment(adminId, "OWNER", org.id, created.id, newStart, new Date(newStart.getTime() + 60 * 60 * 1000));
    assert.equal(moved.kind, "ok");

    const detail = await getAppointment(org.id, created.id);
    assert.equal(detail?.appointment.startAt.toISOString(), newStart.toISOString());
    assert.equal(detail?.events.some((e) => e.eventType === "RESCHEDULED"), true);

    // Terminal state is immutable.
    assert.equal((await setAppointmentStatus(adminId, "OWNER", org.id, created.id, "COMPLETED")).kind, "ok");
    const terminalStart = dayStart(7);
    assert.equal(
      (await rescheduleAppointment(adminId, "OWNER", org.id, created.id, terminalStart, new Date(terminalStart.getTime() + 60 * 60 * 1000))).kind,
      "invalid_transition",
    );

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

/**
 * The Phase 4 concurrency proof: two truly-concurrent bookings for the same
 * staff member in the same hour. Without the pg_advisory_xact_lock keyed on
 * (assignee, day), both transactions would read "no overlap" and both would
 * insert. With it, the second blocks until the first commits, then sees the
 * committed row and returns SLOT_CONFLICT. Exactly one must succeed.
 */
test("concurrent appointments for the same staff member cannot both succeed (double-booking race)", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");
    const { createAppointment } = await import("../../src/server/services/appointments");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contactA = await seedContact(adminId, org.id, "Aya", "Prospect");
    const contactB = await seedContact(adminId, org.id, "Bilel", "Prospect");

    const start = dayStart(2);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const [resultA, resultB] = await Promise.all([
      createAppointment(adminId, "OWNER", org.id, { contactId: contactA.id, assignedToUserId: ownerId, type: "ASSESSMENT", startAt: start, endAt: end }),
      createAppointment(adminId, "OWNER", org.id, { contactId: contactB.id, assignedToUserId: ownerId, type: "ASSESSMENT", startAt: start, endAt: end }),
    ]);

    const outcomes = [resultA.kind, resultB.kind].sort();
    assert.deepEqual(outcomes, ["ok", "slot_conflict"], `expected exactly one success, got ${JSON.stringify(outcomes)}`);

    const count = await client.query(
      `select count(*)::int as n from appointment where organization_id = $1 and assigned_to_user_id = $2 and status in ('SCHEDULED','CONFIRMED')`,
      [org.id, ownerId],
    );
    assert.equal(count.rows[0].n, 1);

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});

test("DB rejects an appointment with an invalid status or an inverted time range", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { createOrganization } = await import("../../src/server/services/organizations");

    const adminId = await seedUser(client);
    const ownerId = await seedUser(client);
    const org = await createOrganization(adminId, { name: "Apt Org", slug: `apt-${crypto.randomUUID()}` }, ownerId);
    const contact = await seedContact(adminId, org.id, "Aya", "Prospect");

    const start = dayStart(2);
    await assert.rejects(
      client.query(
        `insert into appointment (id, organization_id, contact_id, assigned_to_user_id, created_by_user_id, start_at, end_at, status, created_at, updated_at)
         values ($1, $2, $3, $4, $4, $5, $6, 'BOGUS', now(), now())`,
        [crypto.randomUUID(), org.id, contact.id, ownerId, start, new Date(start.getTime() + 3600_000)],
      ),
      /check constraint|violates/i,
    );
    await assert.rejects(
      client.query(
        `insert into appointment (id, organization_id, contact_id, assigned_to_user_id, created_by_user_id, start_at, end_at, status, created_at, updated_at)
         values ($1, $2, $3, $4, $4, $5, $6, 'SCHEDULED', now(), now())`,
        [crypto.randomUUID(), org.id, contact.id, ownerId, start, new Date(start.getTime() - 3600_000)],
      ),
      /check constraint|violates/i,
    );

    await cleanup(client, [org.id], [adminId, ownerId]);
  });
});