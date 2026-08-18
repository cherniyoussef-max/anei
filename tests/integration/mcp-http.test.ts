process.env.ENABLE_AI = "true";
process.env.ENABLE_MCP = "true";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import { setMcpSessionResolver, hashServiceToken } from "@/server/mcp/auth";
import { resetMcpServer } from "@/server/mcp/server";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);
if (!url) throw new Error("A test database URL is required");
process.env.TEST_DATABASE_URL = url;

const MCP_URL = "http://localhost:3000/api/mcp";
const SERVICE_ALLOWED_TOOL_COUNT = 7;

function uuid() {
  return crypto.randomUUID();
}

async function withClient(run: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

async function seedUser(client: Client, role = "USER") {
  const id = uuid();
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, locale, created_at, updated_at)
     values ($1, 'MCP Test', $2, true, $3, 'learner', 'fr', now(), now())`,
    [id, `mcp-${id}@example.test`, role],
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

async function seedServiceCredential(client: Client, rawToken: string, orgId: string | null, scopes: string[], status = "ACTIVE", expiresAt: Date | null = null) {
  const id = uuid();
  await client.query(
    `insert into automation_service_credential (id, name, token_hash, organization_id, scopes, status, expires_at, created_at)
     values ($1, 'Test Credential', $2, $3, $4::jsonb, $5, $6, now())`,
    [id, hashServiceToken(rawToken), orgId, JSON.stringify(scopes), status, expiresAt],
  );
  return id;
}

async function seedCourse(client: Client, _orgId: string, name = "Course A") {
  const id = uuid();
  await client.query(
    `insert into courses (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
       category, level, mode, trainer_name, duration_minutes, price_millimes, objectives, published, created_at, updated_at)
     values ($1, $2, $3, $3, 'sum fr', 'sum ar', 'desc fr', 'desc ar',
       'inclusion', 'beginner', 'online', 'Trainer', 60, 0, '{"fr":[],"ar":[]}', true, now(), now())`,
    [id, `course-${uuid()}`, name],
  );
  return id;
}

function jsonrpc(id: number | string, method: string, params?: Record<string, unknown>) {
  return { jsonrpc: "2.0", id, method, params };
}

async function postMcp(body: unknown, init?: RequestInit): Promise<{ response: Response; sessionId: string | null }> {
  const { POST } = await import("@/app/api/mcp/route");
  const request = new Request(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  const sessionId = response.headers.get("Mcp-Session-Id");
  return { response, sessionId };
}

async function mcpInitialize(sessionId: string | null, headers?: Record<string, string>) {
  return postMcp(
    jsonrpc(1, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "anei-tests", version: "0.0.0" },
    }),
    { headers: { ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}), ...(headers ?? {}) } },
  );
}

async function mcpToolsList(sessionId: string | null, headers?: Record<string, string>) {
  return postMcp(jsonrpc(2, "tools/list", {}), {
    headers: { ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}), ...(headers ?? {}) },
  });
}

async function mcpToolsCall(sessionId: string | null, name: string, args: Record<string, unknown>, headers?: Record<string, string>) {
  return postMcp(jsonrpc(3, "tools/call", { name, arguments: args }), {
    headers: { ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}), ...(headers ?? {}) },
  });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  return JSON.parse(text);
}

test("MCP: unauthenticated request denied", { skip: !url }, async () => {
  setMcpSessionResolver(async () => null);
  resetMcpServer();
  const { response } = await postMcp(jsonrpc(1, "initialize", {}));
  assert.equal(response.status, 401);
});

test("MCP: untrusted origin denied (session path)", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await seedUser(client);
    setMcpSessionResolver(async () => ({ user: { id: userId, locale: "fr" } }));
    resetMcpServer();
    const { response } = await postMcp(jsonrpc(1, "initialize", {}), {
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    });
    assert.equal(response.status, 403);
  });
});

test("MCP: invalid service credential denied", { skip: !url }, async () => {
  resetMcpServer();
  const { response } = await postMcp(jsonrpc(1, "initialize", {}), {
    headers: { Authorization: "Bearer definitely-not-a-real-token" },
  });
  assert.equal(response.status, 401);
});

test("MCP: GET/DELETE are rejected with 405", { skip: !url }, async () => {
  const { GET, DELETE } = await import("@/app/api/mcp/route");
  const getRes = await GET();
  const delRes = await DELETE();
  assert.equal(getRes.status, 405);
  assert.equal(delRes.status, 405);
});

test("MCP: valid service credential lists read-only allowlist", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgId = await seedOrg(client);
    const token = `tok-${uuid()}`;
    await seedServiceCredential(client, token, orgId, [
      "anei:knowledge:read",
      "anei:courses:read",
      "anei:students:read",
      "anei:appointments:read",
      "anei:crm:write",
      "anei:appointments:write",
    ]);
    resetMcpServer();

    const { response, sessionId } = await mcpInitialize(null, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 200, await response.text());

    const list = await mcpToolsList(sessionId, { Authorization: `Bearer ${token}` });
    assert.equal(list.response.status, 200);
    const body = (await readJson(list.response)) as { result: { tools: Array<{ name: string }> } };
    const names = body.result.tools.map((t) => t.name).sort();
    assert.equal(names.length, SERVICE_ALLOWED_TOOL_COUNT);
    for (const name of [
      "search_knowledge",
      "get_my_courses",
      "get_my_enrollments",
      "get_course_details",
      "get_student_progress",
      "get_cohort_information",
      "list_my_appointments",
    ]) {
      assert.ok(names.includes(name), `expected ${name} in MCP allowlist`);
    }
    for (const forbidden of ["create_crm_note", "add_crm_tag", "create_appointment", "enroll_student", "reschedule_appointment", "send_whatsapp_template", "assign_teacher"]) {
      assert.ok(!names.includes(forbidden), `${forbidden} must not be exposed over MCP`);
    }
  });
});

test("MCP: service credential without scope is forbidden for that tool", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgId = await seedOrg(client);
    const token = `tok-${uuid()}`;
    await seedServiceCredential(client, token, orgId, ["anei:crm:write"]);
    resetMcpServer();

    const { sessionId } = await mcpInitialize(null, { Authorization: `Bearer ${token}` });
    const call = await mcpToolsCall(sessionId, "search_knowledge", { query: "inclusive education" }, { Authorization: `Bearer ${token}` });
    const body = (await readJson(call.response)) as { result: { isError: boolean; content: Array<{ text: string }> } };
    assert.equal(body.result.isError, true);
    assert.match(body.result.content[0].text, /scope/i);
  });
});

test("MCP: expired service credential denied", { skip: !url }, async () => {
  await withClient(async (client) => {
    const token = `tok-${uuid()}`;
    await seedServiceCredential(client, token, null, ["anei:knowledge:read"], "ACTIVE", new Date(Date.now() - 60_000));
    resetMcpServer();
    const { response } = await mcpInitialize(null, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 401);
  });
});

test("MCP: revoked service credential denied", { skip: !url }, async () => {
  await withClient(async (client) => {
    const token = `tok-${uuid()}`;
    await seedServiceCredential(client, token, null, ["anei:knowledge:read"], "REVOKED");
    resetMcpServer();
    const { response } = await mcpInitialize(null, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 401);
  });
});

test("MCP: service actor cannot execute LOW_RISK_WRITE tools", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgId = await seedOrg(client);
    const token = `tok-${uuid()}`;
    await seedServiceCredential(client, token, orgId, ["anei:crm:write", "anei:courses:read"]);
    resetMcpServer();

    const userId = await seedUser(client);
    const contactId = uuid();
    await client.query(
      `insert into crm_contact (id, organization_id, first_name, last_name, created_by_user_id, created_at, updated_at)
       values ($1, $2, 'Amina', 'Test', $3, now(), now())`,
      [contactId, orgId, userId],
    );

    const { sessionId } = await mcpInitialize(null, { Authorization: `Bearer ${token}` });
    const call = await mcpToolsCall(sessionId, "create_crm_note", { contactId, body: "Note from automation" }, { Authorization: `Bearer ${token}` });
    const body = (await readJson(call.response)) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    assert.equal(body.result.isError ?? false, true);
    assert.match(body.result.content[0].text, /scope|forbidden|not found|unauthorized/i);

    const notes = await client.query(
      "select author_user_id, body from crm_contact_note where contact_id = $1",
      [contactId],
    );
    assert.equal(notes.rowCount, 0);

    // cleanup
    await client.query("delete from crm_contact where id = $1", [contactId]);
  });
});

test("MCP: service actor cannot execute BUSINESS_WRITE tools", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgId = await seedOrg(client);
    const token = `tok-${uuid()}`;
    await seedServiceCredential(client, token, orgId, ["anei:appointments:write"]);
    resetMcpServer();

    const userId = await seedUser(client);
    const { sessionId } = await mcpInitialize(null, { Authorization: `Bearer ${token}` });
    const call = await mcpToolsCall(
      sessionId,
      "create_appointment",
      { contactId: uuid(), assignedToUserId: userId, type: "INFO_MEETING", startAt: "2030-01-01T09:00:00.000Z", endAt: "2030-01-01T10:00:00.000Z" },
      { Authorization: `Bearer ${token}` },
    );
    const body = (await readJson(call.response)) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    assert.equal(body.result.isError ?? false, true);
    assert.match(body.result.content[0].text, /scope|forbidden|not found|unauthorized/i);

    const appointments = await client.query("select count(*)::int as n from appointment where organization_id = $1", [orgId]);
    assert.equal(appointments.rows[0].n, 0, "propose-only must never create an appointment");
  });
});

test("MCP: browser session can still create appointment proposal", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await seedUser(client, "ADMIN");
    const orgId = await seedOrg(client);
    const contactId = uuid();
    await client.query(
      `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
       values ($1, $2, $3, 'OWNER', 'ACTIVE', now(), now())`,
      [uuid(), orgId, userId],
    );
    await client.query(
      `insert into crm_contact (id, organization_id, first_name, last_name, created_by_user_id, created_at, updated_at)
       values ($1, $2, 'Amina', 'Session', $3, now(), now())`,
      [contactId, orgId, userId],
    );

    setMcpSessionResolver(async () => ({ user: { id: userId, locale: "fr" } }));
    resetMcpServer();

    const { response, sessionId } = await mcpInitialize(null, { Origin: "http://localhost:3000" });
    assert.equal(response.status, 200);

    const list = await mcpToolsList(sessionId, { Origin: "http://localhost:3000" });
    const listBody = (await readJson(list.response)) as { result: { tools: Array<{ name: string }> } };
    const names = listBody.result.tools.map((tool) => tool.name);
    assert.ok(names.includes("create_appointment"));

    const call = await mcpToolsCall(
      sessionId,
      "create_appointment",
      {
        contactId,
        assignedToUserId: userId,
        type: "INFO_MEETING",
        startAt: "2030-01-01T09:00:00.000Z",
        endAt: "2030-01-01T10:00:00.000Z",
      },
      { Origin: "http://localhost:3000" },
    );
    const body = (await readJson(call.response)) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    assert.equal(body.result.isError ?? false, false, body.result.content?.[0]?.text);
    const parsed = JSON.parse(body.result.content[0].text) as { confirmationRequired: boolean; executionId: string };
    assert.equal(parsed.confirmationRequired, true);
    assert.ok(parsed.executionId);

    const appointments = await client.query("select count(*)::int as n from appointment where organization_id = $1", [orgId]);
    assert.equal(appointments.rows[0].n, 0);
  });
});

test("MCP: user session can read own enrollments", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await seedUser(client);
    const orgId = await seedOrg(client);
    const courseId = await seedCourse(client, orgId);
    await client.query(
      `insert into enrollments (id, user_id, course_id, status, source, enrolled_at)
       values ($1, $2, $3, 'active', 'ORGANIZATION', now())`,
      [uuid(), userId, courseId],
    );
    setMcpSessionResolver(async () => ({ user: { id: userId, locale: "fr" } }));
    resetMcpServer();

    const { response, sessionId } = await mcpInitialize(null, { Origin: "http://localhost:3000" });
    assert.equal(response.status, 200);
    const call = await mcpToolsCall(sessionId, "get_my_enrollments", {}, { Origin: "http://localhost:3000" });
    const body = (await readJson(call.response)) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    const parsed = JSON.parse(body.result.content[0].text) as { enrollments: Array<{ courseId: string }> };
    assert.equal(parsed.enrollments.length, 1);
    assert.equal(parsed.enrollments[0].courseId, courseId);

    await client.query("delete from enrollments where user_id = $1", [userId]);
  });
});

test("MCP: every exposed tool authorizes at execution time for the caller", { skip: !url }, async () => {
  await withClient(async (client) => {
    const userId = await seedUser(client);
    setMcpSessionResolver(async () => ({ user: { id: userId, locale: "fr" } }));
    resetMcpServer();

    const { response, sessionId } = await mcpInitialize(null, { Origin: "http://localhost:3000" });
    assert.equal(response.status, 200);
    // get_student_progress on an unrelated user must be denied (no relationship).
    const stranger = await seedUser(client, "USER");
    const call = await mcpToolsCall(sessionId, "get_student_progress", { userId: stranger }, { Origin: "http://localhost:3000" });
    const body = (await readJson(call.response)) as { result: { isError: boolean; content: Array<{ text: string }> } };
    assert.equal(body.result.isError, true);
  });
});

test.after(() => {
  setMcpSessionResolver(null);
  resetMcpServer();
});
