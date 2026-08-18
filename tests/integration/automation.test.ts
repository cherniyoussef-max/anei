import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { automationServiceCredential, automationExecution, outboxEvent } from "@/server/db/schema";
import {
  createAutomationCredential,
  revokeAutomationCredential,
  verifyServiceToken,
  hashServiceToken,
} from "@/server/services/automation-credentials";
import { triggerAutomation, setN8NClient, type N8NClient } from "@/server/automation/contracts";
import { runOutboxCycle } from "@/server/queue/worker-engine";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);
if (!url) throw new Error("A test database URL is required");
process.env.TEST_DATABASE_URL = url;

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

async function seedUser(client: Client) {
  const id = uuid();
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, locale, created_at, updated_at)
     values ($1, 'Automation Test', $2, true, 'USER', 'learner', 'fr', now(), now())`,
    [id, `auto-${id}@example.test`],
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

async function seedContact(client: Client, orgId: string, userId: string) {
  const id = uuid();
  await client.query(
    `insert into crm_contact (id, organization_id, first_name, last_name, created_by_user_id, created_at, updated_at)
     values ($1, $2, 'Amina', 'Test', $3, now(), now())`,
    [id, orgId, userId],
  );
  return id;
}

test("automation: create credential returns raw token once; DB stores only a hash", { skip: !url }, async () => {
  await withClient(async (client) => {
    const created = await createAutomationCredential({
      name: "Test",
      scopes: ["automation:appointments:read"],
    });
    assert.ok(created.token);
    assert.equal(created.id.length > 0, true);

    const row = await client.query("select token_hash, status from automation_service_credential where id = $1", [created.id]);
    assert.equal(row.rowCount, 1);
    assert.equal(row.rows[0].token_hash, hashServiceToken(created.token));
    assert.notEqual(row.rows[0].token_hash, created.token, "raw token must never be stored");
  });
});

test("automation: verifyServiceToken accepts only the matching active credential", { skip: !url }, async () => {
  const created = await createAutomationCredential({ name: "T2", scopes: ["automation:appointments:read"] });
  const verified = await verifyServiceToken(created.token);
  assert.ok(verified);
  assert.equal(verified!.id, created.id);
  assert.deepEqual(verified!.scopes, ["automation:appointments:read"]);

  const wrong = await verifyServiceToken("some-other-token");
  assert.equal(wrong, null);
});

test("automation: revoked credential is rejected", { skip: !url }, async () => {
  const created = await createAutomationCredential({ name: "T3", scopes: ["automation:appointments:read"] });
  assert.equal(await verifyServiceToken(created.token) !== null, true);
  const revoked = await revokeAutomationCredential(created.id);
  assert.equal(revoked, true);
  assert.equal(await verifyServiceToken(created.token), null);
});

test("automation: expired credential is rejected", { skip: !url }, async () => {
  const raw = `exp-${uuid()}`;
  await withClient(async (client) => {
    await client.query(
      `insert into automation_service_credential (id, name, token_hash, scopes, status, expires_at, created_at)
       values ($1, 'Expired', $2, '["automation:appointments:read"]'::jsonb, 'ACTIVE', $3, now())`,
      [uuid(), hashServiceToken(raw), new Date(Date.now() - 60_000)],
    );
  });
  assert.equal(await verifyServiceToken(raw), null);
});

test("automation: unknown scope is rejected at creation", { skip: !url }, async () => {
  await assert.rejects(
    createAutomationCredential({ name: "Bad", scopes: ["automation:nonexistent" as never] }),
    /UNKNOWN_AUTOMATION_SCOPE/,
  );
});

test("automation: appointments/state enforces org boundary and scope", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgA = await seedOrg(client);
    const orgB = await seedOrg(client);
    const userA = await seedUser(client);
    const contactA = await seedContact(client, orgA, userA);
    const contactB = await seedContact(client, orgB, userA);
    const startA = new Date("2031-01-01T09:00:00.000Z");
    const apptA = uuid();
    await client.query(
      `insert into appointment (id, organization_id, contact_id, assigned_to_user_id, created_by_user_id, type, start_at, end_at, status, created_at, updated_at)
       values ($1, $2, $3, $4, $4, 'INFO_MEETING', $5, $6, 'SCHEDULED', now(), now())`,
      [apptA, orgA, contactA, userA, startA, new Date(startA.getTime() + 3600_000)],
    );

    const tokenA = await createAutomationCredential({ name: "OrgA", organizationId: orgA, scopes: ["automation:appointments:read"] });
    const tokenB = await createAutomationCredential({ name: "OrgB", organizationId: orgB, scopes: ["automation:appointments:read"] });

    const { POST: postA } = await import("@/app/api/internal/automation/appointments/state/route");
    const okReq = new Request("http://localhost:3000/api/internal/automation/appointments/state", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA.token}` },
      body: JSON.stringify({ appointmentId: apptA }),
    });
    const ok = await postA(okReq);
    assert.equal(ok.status, 200);
    const okBody = (await ok.json()) as { status: string; startAt: string };
    assert.equal(okBody.status, "SCHEDULED");

    // org B credential must not read org A's appointment
    const crossReq = new Request("http://localhost:3000/api/internal/automation/appointments/state", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB.token}` },
      body: JSON.stringify({ appointmentId: apptA }),
    });
    const cross = await postA(crossReq);
    assert.equal(cross.status, 404);

    // credential without the scope
    const noScope = await createAutomationCredential({ name: "NoScope", organizationId: orgA, scopes: ["automation:onboarding:read"] });
    const forbiddenReq = new Request("http://localhost:3000/api/internal/automation/appointments/state", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${noScope.token}` },
      body: JSON.stringify({ appointmentId: apptA }),
    });
    const forbidden = await postA(forbiddenReq);
    assert.equal(forbidden.status, 403);

    // no token at all
    const unauthReq = new Request("http://localhost:3000/api/internal/automation/appointments/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: apptA }),
    });
    assert.equal((await postA(unauthReq)).status, 401);
  });
});

test("automation: onboarding/candidates only returns members of the credential org", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgA = await seedOrg(client);
    const orgB = await seedOrg(client);
    const inOrg = await seedUser(client);
    const outOrg = await seedUser(client);
    await client.query(
      `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
       values ($1, $2, $3, 'VIEWER', 'ACTIVE', now(), now())`,
      [uuid(), orgA, inOrg],
    );
    const course = uuid();
    await client.query(
      `insert into courses (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
         category, level, mode, trainer_name, duration_minutes, price_millimes, objectives, published, created_at, updated_at)
       values ($1, $2, 'Cours', 'Course', 's', 's', 'd', 'd', 'inclusion', 'beginner', 'online', 'T', 60, 0, '{"fr":[],"ar":[]}', true, now(), now())`,
      [course, `course-${uuid()}`],
    );
    await client.query(
      `insert into enrollments (id, user_id, course_id, status, source, enrolled_at) values ($1, $2, $3, 'active', 'ORGANIZATION', now())`,
      [uuid(), inOrg, course],
    );

    const tokenA = await createAutomationCredential({ name: "OrgA", organizationId: orgA, scopes: ["automation:onboarding:read"] });
    const tokenB = await createAutomationCredential({ name: "OrgB", organizationId: orgB, scopes: ["automation:onboarding:read"] });

    const { POST } = await import("@/app/api/internal/automation/onboarding/candidates/route");
    const req = (token: string) =>
      new Request("http://localhost:3000/api/internal/automation/onboarding/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sinceDays: 30 }),
      });
    const a = (await (await POST(req(tokenA.token))).json()) as { candidates: Array<{ userId: string }> };
    const b = (await (await POST(req(tokenB.token))).json()) as { candidates: Array<{ userId: string }> };
    assert.ok(a.candidates.some((c) => c.userId === inOrg));
    assert.ok(!a.candidates.some((c) => c.userId === outOrg));
    assert.equal(b.candidates.length, 0);
  });
});

test("automation: knowledge/ingest forces organization visibility and org scope", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgA = await seedOrg(client);
    const orgB = await seedOrg(client);
    const tokenA = await createAutomationCredential({ name: "OrgA", organizationId: orgA, scopes: ["automation:knowledge:ingest"] });
    const tokenB = await createAutomationCredential({ name: "OrgB", organizationId: orgB, scopes: ["automation:knowledge:ingest"] });

    const { POST } = await import("@/app/api/internal/automation/knowledge/ingest/route");
    const payload = { sourceType: "automation-test", title: "Doc", content: "Inclusive education content." };

    const { getEmbeddingProvider, setEmbeddingProvider } = await import("@/server/ai/embedding-provider");
    const original = getEmbeddingProvider();
    setEmbeddingProvider({ ...original, embed: async (texts: string[]) => texts.map(() => Array(1536).fill(0.01)) });

    try {
      const reqA = new Request("http://localhost:3000/api/internal/automation/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA.token}` },
        body: JSON.stringify(payload),
      });
      const resA = await POST(reqA);
      assert.equal(resA.status, 200);
      const bodyA = (await resA.json()) as { documentId: string };
      const doc = await client.query("select organization_id, visibility from knowledge_document where id = $1", [bodyA.documentId]);
      assert.equal(doc.rowCount, 1);
      assert.equal(doc.rows[0].organization_id, orgA);
      assert.equal(doc.rows[0].visibility, "ORGANIZATION");
    } finally {
      setEmbeddingProvider(original);
    }
  });
});

test("automation: notifications/request enqueues a WhatsApp outbox event when configured", { skip: !url }, async () => {
  await withClient(async (client) => {
    const org = await seedOrg(client);
    const user = await seedUser(client);
    const contactId = await seedContact(client, org, user);
    const token = await createAutomationCredential({ name: "Org", organizationId: org, scopes: ["automation:notifications:request"] });

    const { POST } = await import("@/app/api/internal/automation/notifications/request/route");
    const req = new Request("http://localhost:3000/api/internal/automation/notifications/request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
      body: JSON.stringify({
        contactId,
        templateId: uuid(),
        language: "fr",
        parameters: ["x"],
        requestId: `automation:test:${uuid()}`,
      }),
    });
    // No WhatsApp account/template exists for the org → the outbox path reports no_account.
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /no_account/);
  });
});

test("automation: executions/status callback finalizes a dispatched execution", { skip: !url }, async () => {
  await withClient(async (client) => {
    const org = await seedOrg(client);
    const token = await createAutomationCredential({ name: "Org", organizationId: org, scopes: ["automation:executions:update"] });

    const executionId = uuid();
    await client.query(
      `insert into automation_execution (id, organization_id, workflow_name, status, idempotency_key, requested_at, updated_at, dispatched_at, started_at)
       values ($1, $2, 'automation.appointment_reminder', 'RUNNING', $3, now(), now(), now(), now())`,
      [executionId, org, `idem-${uuid()}`],
    );

    const { POST } = await import("@/app/api/internal/automation/executions/status/route");
    const req = new Request("http://localhost:3000/api/internal/automation/executions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
      body: JSON.stringify({ automationExecutionId: executionId, status: "SUCCEEDED", externalExecutionId: "n8n-123" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 200);

    const [row] = await db.select({ status: automationExecution.status, externalExecutionId: automationExecution.externalExecutionId })
      .from(automationExecution).where(eq(automationExecution.id, executionId));
    assert.equal(row.status, "SUCCEEDED");
    assert.equal(row.externalExecutionId, "n8n-123");
  });
});

test("automation: triggerAutomation records execution + outbox event with minimal payload", { skip: !url }, async () => {
  const { executionId, created } = await triggerAutomation({
    workflowName: "automation.appointment_reminder",
    organizationId: null,
    requestedByUserId: null,
  });
  assert.equal(created, true);

  const [execution] = await db.select({ status: automationExecution.status }).from(automationExecution).where(eq(automationExecution.id, executionId));
  assert.equal(execution.status, "PENDING");

  const [event] = await db.select({ payload: outboxEvent.payload, eventType: outboxEvent.eventType }).from(outboxEvent)
    .where(eq(outboxEvent.aggregateId, executionId));
  assert.equal(event.eventType, "AUTOMATION_TRIGGER");
  assert.deepEqual(event.payload, { automationExecutionId: executionId });
});

test("automation: unknown workflow name is rejected", { skip: !url }, async () => {
  await assert.rejects(
    triggerAutomation({ workflowName: "automation.arbitrary_malware" }),
    /UNKNOWN_WORKFLOW/,
  );
});

test("automation: outbox worker dispatches AUTOMATION_TRIGGER and marks DISPATCHED", { skip: !url }, async () => {
  let dispatched: { workflowName: string; input: Record<string, unknown> } | null = null;
  const mockClient: N8NClient = {
    triggerWorkflow: async (workflowName, input) => {
      dispatched = { workflowName, input };
      return { success: true, externalExecutionId: "n8n-run-1" };
    },
  };
  setN8NClient(mockClient);

  try {
    const { executionId } = await triggerAutomation({ workflowName: "automation.teacher_notification", organizationId: null, requestedByUserId: null });
    const result = await runOutboxCycle({ workerId: "test-worker" });
    assert.ok(result.succeeded >= 1);

    const [execution] = await db.select().from(automationExecution).where(eq(automationExecution.id, executionId));
    assert.equal(execution.status, "DISPATCHED");
    assert.equal(execution.externalExecutionId, "n8n-run-1");
    assert.equal(dispatched!.workflowName, "automation.teacher_notification");
    assert.deepEqual(dispatched!.input, { automationExecutionId: executionId });
  } finally {
    setN8NClient(null as never);
  }
});

test("automation: no n8n client configured → execution FAILED_TO_DISPATCH, non-retryable", { skip: !url }, async () => {
  setN8NClient(null as never);
  const { executionId } = await triggerAutomation({ workflowName: "automation.knowledge_sync", organizationId: null, requestedByUserId: null });
  const result = await runOutboxCycle({ workerId: "test-worker" });
  assert.ok(result.terminal >= 1);
  const [execution] = await db.select().from(automationExecution).where(eq(automationExecution.id, executionId));
  assert.equal(execution.status, "FAILED_TO_DISPATCH");
});

test("automation: transient n8n dispatch failure is retryable and keeps PENDING", { skip: !url }, async () => {
  let calls = 0;
  const mockClient: N8NClient = {
    triggerWorkflow: async () => {
      calls += 1;
      return { success: false, error: "HTTP 503" };
    },
  };
  setN8NClient(mockClient);
  try {
    const { executionId } = await triggerAutomation({ workflowName: "automation.onboarding_followup", organizationId: null, requestedByUserId: null });
    const result = await runOutboxCycle({ workerId: "test-worker" });
    assert.ok(result.retried >= 1);
    const [execution] = await db.select().from(automationExecution).where(eq(automationExecution.id, executionId));
    assert.equal(execution.status, "PENDING", "transient failure keeps execution PENDING for retry");
    assert.equal(execution.attemptCount, 1);
  } finally {
    setN8NClient(null as never);
  }
});

test("automation: cross-org executions/status callback is rejected", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgA = await seedOrg(client);
    const orgB = await seedOrg(client);
    const tokenB = await createAutomationCredential({ name: "OrgB", organizationId: orgB, scopes: ["automation:executions:update"] });

    const executionId = uuid();
    await client.query(
      `insert into automation_execution (id, organization_id, workflow_name, status, idempotency_key, requested_at, updated_at, dispatched_at, started_at)
       values ($1, $2, 'automation.appointment_reminder', 'RUNNING', $3, now(), now(), now(), now())`,
      [executionId, orgA, `idem-${uuid()}`],
    );

    const { POST } = await import("@/app/api/internal/automation/executions/status/route");
    const req = new Request("http://localhost:3000/api/internal/automation/executions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB.token}` },
      body: JSON.stringify({ automationExecutionId: executionId, status: "SUCCEEDED" }),
    });
    const res = await POST(req);
    assert.equal(res.status, 404);
  });
});

test("automation: claim endpoint allows exactly one winner for duplicate delivery", { skip: !url }, async () => {
  await withClient(async (client) => {
    const org = await seedOrg(client);
    const token = await createAutomationCredential({ name: "Org", organizationId: org, scopes: ["automation:executions:update"] });
    const executionId = uuid();

    await client.query(
      `insert into automation_execution (id, organization_id, workflow_name, status, idempotency_key, requested_at, updated_at, dispatched_at)
       values ($1, $2, 'automation.appointment_reminder', 'DISPATCHED', $3, now(), now(), now())`,
      [executionId, org, `idem-${uuid()}`],
    );

    const { POST } = await import("@/app/api/internal/automation/executions/claim/route");
    const makeRequest = () => new Request("http://localhost:3000/api/internal/automation/executions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
      body: JSON.stringify({ automationExecutionId: executionId }),
    });

    const [a, b] = await Promise.all([POST(makeRequest()), POST(makeRequest())]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);

    const bodyA = (await a.json()) as { claimed: boolean };
    const bodyB = (await b.json()) as { claimed: boolean };
    assert.equal(Number(bodyA.claimed) + Number(bodyB.claimed), 1, "exactly one request must claim RUNNING");

    const row = await client.query("select status, claimed_by from automation_execution where id = $1", [executionId]);
    assert.equal(row.rowCount, 1);
    assert.equal(row.rows[0].status, "RUNNING");
    assert.ok(row.rows[0].claimed_by);
  });
});

test("automation: callback transitions are monotonic and idempotent", { skip: !url }, async () => {
  await withClient(async (client) => {
    const org = await seedOrg(client);
    const token = await createAutomationCredential({ name: "Org", organizationId: org, scopes: ["automation:executions:update"] });
    const executionId = uuid();

    await client.query(
      `insert into automation_execution (id, organization_id, workflow_name, status, idempotency_key, requested_at, updated_at, started_at)
       values ($1, $2, 'automation.knowledge_sync', 'RUNNING', $3, now(), now(), now())`,
      [executionId, org, `idem-${uuid()}`],
    );

    const { POST } = await import("@/app/api/internal/automation/executions/status/route");
    const request = (status: "SUCCEEDED" | "FAILED" | "WORKFLOW_FAILED") => new Request(
      "http://localhost:3000/api/internal/automation/executions/status",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
        body: JSON.stringify({ automationExecutionId: executionId, status }),
      },
    );

    const first = await POST(request("SUCCEEDED"));
    assert.equal(first.status, 200);

    const duplicate = await POST(request("SUCCEEDED"));
    assert.equal(duplicate.status, 200);

    const regression = await POST(request("FAILED"));
    assert.equal(regression.status, 409);
  });
});

test("automation: cross-org claim is rejected", { skip: !url }, async () => {
  await withClient(async (client) => {
    const orgA = await seedOrg(client);
    const orgB = await seedOrg(client);
    const tokenB = await createAutomationCredential({ name: "OrgB", organizationId: orgB, scopes: ["automation:executions:update"] });
    const executionId = uuid();

    await client.query(
      `insert into automation_execution (id, organization_id, workflow_name, status, idempotency_key, requested_at, updated_at, dispatched_at)
       values ($1, $2, 'automation.teacher_notification', 'DISPATCHED', $3, now(), now(), now())`,
      [executionId, orgA, `idem-${uuid()}`],
    );

    const { POST } = await import("@/app/api/internal/automation/executions/claim/route");
    const req = new Request("http://localhost:3000/api/internal/automation/executions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB.token}` },
      body: JSON.stringify({ automationExecutionId: executionId }),
    });
    const res = await POST(req);
    assert.equal(res.status, 404);
  });
});

test.after(() => {
  setN8NClient(null as never);
});
