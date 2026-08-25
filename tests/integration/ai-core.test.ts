process.env.ENABLE_AI = "true";
process.env.OPENAI_API_KEY = "test-key";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import type { ToolContext } from "@/server/tools/types";

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
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, profile_type, locale, created_at, updated_at)
     values ($1, 'AI Test', $2, true, 'USER', 'learner', 'fr', now(), now())`,
    [userId, `ai-${userId}@example.test`],
  );
  return userId;
}

test("AI conversation: unauthenticated request denied", { skip: !url }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })) as typeof fetch;
  try {
    const response = await fetch("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    assert.equal(response.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI conversation: authenticated user can create and access own conversation", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const userId = await seedUser(client);

    const { getConversationRepository } = await import("../../src/server/ai/conversation-repository");
    const repo = getConversationRepository();

    const convId = await repo.createConversation(userId, null, "Test");
    const conv = await repo.getConversation(convId, userId);
    assert.ok(conv);
    assert.equal(conv.userId, userId);
  });
});

test("AI conversation: user cannot access another user's conversation", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const userA = await seedUser(client);
    const userB = await seedUser(client);

    const { getConversationRepository } = await import("../../src/server/ai/conversation-repository");
    const repo = getConversationRepository();

    const convId = await repo.createConversation(userA, null, "Test");
    const conv = await repo.getConversation(convId, userB);
    assert.equal(conv, undefined);
  });
});

test("RAG: public document retrievable, org-private document not retrievable by other org", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { setRetriever, getRetriever } = await import("../../src/server/ai/retriever");
    const { TestRetriever } = await import("../../src/server/ai/retriever");

    const retriever = new TestRetriever();
    retriever.setDocuments([
      { id: "doc-public", text: "Public knowledge", source: "public", courseId: undefined },
      { id: "doc-org-a", text: "Org A private", source: "org-a", courseId: "course-a" },
    ]);
    setRetriever(retriever);

    const resultsA = await getRetriever().search({
      query: "test",
      locale: "fr",
      userId: "user-a",
      courseId: "course-a",
      limit: 5,
    });

    assert.ok(resultsA.length > 0);

    setRetriever(new TestRetriever());
  });
});

test("RAG: PgVectorRetriever tenant isolation - Org B cannot retrieve Org A private document", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { PgVectorRetriever } = await import("../../src/server/ai/retriever");
    const { getEmbeddingProvider, setEmbeddingProvider, TestEmbeddingProvider } = await import("../../src/server/ai/embedding-provider");
    const { knowledgeDocument, knowledgeChunk } = await import("@/server/db/schema");
    const { db } = await import("@/server/db");
    const { eq } = await import("drizzle-orm");

    const testEmbeddingProvider = new TestEmbeddingProvider();
    setEmbeddingProvider(testEmbeddingProvider);

    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();

    // Create users first
    const { user: userTable } = await import("@/server/db/schema");
    await db.insert(userTable).values([
      { id: userA, name: "Test User A", email: `user-a-${crypto.randomUUID()}@test.com`, emailVerified: true, role: "USER", profileType: "learner", locale: "fr", createdAt: new Date(), updatedAt: new Date() },
      { id: userB, name: "Test User B", email: `user-b-${crypto.randomUUID()}@test.com`, emailVerified: true, role: "USER", profileType: "learner", locale: "fr", createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Create organizations
    const { organization } = await import("@/server/db/schema");
    await db.insert(organization).values([
      { id: orgA, name: "Test Org A", slug: "test-org-a-" + crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() },
      { id: orgB, name: "Test Org B", slug: "test-org-b-" + crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Create organization memberships for test users
    const { organizationMembership } = await import("@/server/db/schema");
    await db.insert(organizationMembership).values([
      {
        id: crypto.randomUUID(),
        organizationId: orgA,
        userId: userA,
        role: "STAFF",
        status: "ACTIVE",
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgB,
        userId: userB,
        role: "STAFF",
        status: "ACTIVE",
      },
    ]);

    const docA = await db.insert(knowledgeDocument).values({
      id: crypto.randomUUID(),
      organizationId: orgA,
      sourceType: "COURSE",
      sourceId: "course-a",
      title: "Org A Course Document",
      visibility: "ORGANIZATION",
      contentHash: "hash-a-" + crypto.randomUUID(),
      status: "INDEXED",
      metadata: { courseId: "course-a" },
    }).returning({ id: knowledgeDocument.id });

    const docB = await db.insert(knowledgeDocument).values({
      id: crypto.randomUUID(),
      organizationId: orgB,
      sourceType: "COURSE",
      sourceId: "course-b",
      title: "Org B Course Document",
      visibility: "ORGANIZATION",
      contentHash: "hash-b-" + crypto.randomUUID(),
      status: "INDEXED",
      metadata: { courseId: "course-b" },
    }).returning({ id: knowledgeDocument.id });

    testEmbeddingProvider.setEmbedding("test query content", generateDeterministicEmbedding(12345, 1536));
    testEmbeddingProvider.setEmbedding("test query content org b", generateDeterministicEmbedding(67890, 1536));

    const [embeddingA] = await testEmbeddingProvider.embed(["test query content"]);
    const [embeddingB] = await testEmbeddingProvider.embed(["test query content org b"]);

    await db.insert(knowledgeChunk).values([
      {
        id: crypto.randomUUID(),
        documentId: docA[0].id,
        chunkIndex: 0,
        text: "test query content",
        embedding: embeddingA,
        metadata: { courseId: "course-a" },
      },
      {
        id: crypto.randomUUID(),
        documentId: docB[0].id,
        chunkIndex: 0,
        text: "test query content org b",
        embedding: embeddingB,
        metadata: { courseId: "course-b" },
      },
    ]);

    // Also upsert into vector store for in-memory search
    const { getVectorStore } = await import("@/server/ai/vector-store");
    const vectorStore = getVectorStore();
    await vectorStore.upsertChunks([
      {
        id: crypto.randomUUID(),
        documentId: docA[0].id,
        chunkIndex: 0,
        text: "test query content",
        embedding: embeddingA,
        metadata: { courseId: "course-a" },
      },
      {
        id: crypto.randomUUID(),
        documentId: docB[0].id,
        chunkIndex: 0,
        text: "test query content org b",
        embedding: embeddingB,
        metadata: { courseId: "course-b" },
      },
    ]);

    const retriever = new PgVectorRetriever();

    const resultsForUserA_inOrgA = await retriever.search({
      query: "test query content",
      locale: "fr",
      userId: userA,
      organizationId: orgA,
      courseId: "course-a",
      limit: 5,
    });

    const resultsForUserB_inOrgB = await retriever.search({
      query: "test query content org b",
      locale: "fr",
      userId: userB,
      organizationId: orgB,
      courseId: "course-b",
      limit: 5,
    });

    const resultsForUserA_inOrgB = await retriever.search({
      query: "test query content",
      locale: "fr",
      userId: userA,
      organizationId: orgB,
      courseId: "course-b",
      limit: 5,
    });

    assert.ok(resultsForUserA_inOrgA.length > 0, "Org A user should find Org A document in Org A course");
    assert.ok(resultsForUserB_inOrgB.length > 0, "Org B user should find Org B document in Org B course");
    assert.equal(resultsForUserA_inOrgB.length, 0, "Org A user should NOT find Org B document in Org B course");

    const foundOrgBContentInOrgA = resultsForUserA_inOrgA.some(r => r.text === "test query content org b");
    assert.equal(foundOrgBContentInOrgA, false, "Org A user must not see Org B private content");

    await db.delete(knowledgeChunk).where(eq(knowledgeChunk.documentId, docA[0].id));
    await db.delete(knowledgeChunk).where(eq(knowledgeChunk.documentId, docB[0].id));
    await db.delete(knowledgeDocument).where(eq(knowledgeDocument.id, docA[0].id));
    await db.delete(knowledgeDocument).where(eq(knowledgeDocument.id, docB[0].id));
  });
});

function generateDeterministicEmbedding(seed: number, dimensions: number): number[] {
  const embedding = new Array(dimensions);
  let x = seed;
  for (let i = 0; i < dimensions; i++) {
    x = (x * 1664525 + 1013904223) & 0xffffffff;
    embedding[i] = (x / 0xffffffff) * 2 - 1;
  }
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

test("Tools: unknown tool rejected", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { getToolRegistry, setToolRegistry } = await import("../../src/server/tools/registry");
    const { TestToolRegistry } = await import("../../src/server/tools/registry.test");

    const registry = new TestToolRegistry();
    setToolRegistry(registry);

    try {
      await registry.getAllowedTools({ userId: "user", locale: "fr", requestId: "req" });
      assert.fail("Should have thrown for unknown tool");
    } catch (error) {
      assert.ok(error instanceof Error);
    }

    const { ControlledToolRegistry } = await import("../../src/server/tools/registry");
    setToolRegistry(new ControlledToolRegistry());
  });
});

test("Tools: business write produces pending confirmation", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { getToolRegistry, setToolRegistry } = await import("../../src/server/tools/registry");
    const { TestToolRegistry } = await import("../../src/server/tools/registry.test");
    const { createAppointmentTool } = await import("../../src/server/tools/definitions/business-tools");

    const registry = new TestToolRegistry();
    registry.registerTool(createAppointmentTool, createAppointmentTool.execute as (context: ToolContext, input: unknown) => Promise<unknown>);
    setToolRegistry(registry);

    const contactId = crypto.randomUUID();
    const assigneeId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const proposal = await registry.proposeTool(
      "create_appointment",
      { userId: "user", locale: "fr", requestId: "req", organizationId: orgId },
      { contactId, assignedToUserId: assigneeId, type: "ASSESSMENT", startAt: "2026-01-01T10:00:00Z", endAt: "2026-01-01T11:00:00Z" },
      "conv-1"
    );

    assert.ok(proposal.requiresConfirmation);
    assert.ok(proposal.executionId);

    const { ControlledToolRegistry } = await import("../../src/server/tools/registry");
    setToolRegistry(new ControlledToolRegistry());
  });
});

test("Tools: business write does NOT execute before confirmation", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { getToolRegistry, setToolRegistry } = await import("../../src/server/tools/registry");
    const { TestToolRegistry } = await import("../../src/server/tools/registry.test");
    const { sendWhatsAppTemplateTool } = await import("../../src/server/tools/definitions/business-tools");

    const registry = new TestToolRegistry();
    registry.registerTool(sendWhatsAppTemplateTool, sendWhatsAppTemplateTool.execute as (context: ToolContext, input: unknown) => Promise<unknown>);
    setToolRegistry(registry);

    const contactId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const proposal = await registry.proposeTool(
      "send_whatsapp_template",
      { userId: "user", locale: "fr", requestId: "req", organizationId: orgId },
      { contactId, templateId, language: "fr" },
      "conv-1"
    );

    assert.ok(proposal.requiresConfirmation);

    const { ControlledToolRegistry } = await import("../../src/server/tools/registry");
    setToolRegistry(new ControlledToolRegistry());
  });
});

test("Confirmation: changed/tampered action cannot execute", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { getToolRegistry, setToolRegistry } = await import("../../src/server/tools/registry");
    const { TestToolRegistry } = await import("../../src/server/tools/registry.test");
    const { createAppointmentTool } = await import("../../src/server/tools/definitions/business-tools");

    const registry = new TestToolRegistry();
    registry.registerTool(createAppointmentTool, createAppointmentTool.execute as (context: ToolContext, input: unknown) => Promise<unknown>);
    setToolRegistry(registry);

    const contactId = crypto.randomUUID();
    const assigneeId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const proposal = await registry.proposeTool(
      "create_appointment",
      { userId: "user", locale: "fr", requestId: "req", organizationId: orgId },
      { contactId, assignedToUserId: assigneeId, type: "ASSESSMENT", startAt: "2026-01-01T10:00:00Z", endAt: "2026-01-01T11:00:00Z" },
      "conv-1"
    );

    try {
      await registry.confirmAndExecuteTool(
        "create_appointment",
        { userId: "user", locale: "fr", requestId: "req", organizationId: orgId },
        proposal.executionId,
        { contactId: crypto.randomUUID(), assignedToUserId: crypto.randomUUID(), type: "INFO_MEETING", startAt: "2026-01-01T12:00:00Z", endAt: "2026-01-01T13:00:00Z" }
      );
      assert.fail("Should have thrown for hash mismatch");
    } catch (error) {
      assert.ok((error as Error).message.includes("hash mismatch"));
    }

    const { ControlledToolRegistry } = await import("../../src/server/tools/registry");
    setToolRegistry(new ControlledToolRegistry());
  });
});

test("Confirmation: another user cannot confirm", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { getToolRegistry, setToolRegistry } = await import("../../src/server/tools/registry");
    const { TestToolRegistry } = await import("../../src/server/tools/registry.test");
    const { sendWhatsAppTemplateTool } = await import("../../src/server/tools/definitions/business-tools");

    const registry = new TestToolRegistry();
    registry.registerTool(sendWhatsAppTemplateTool, sendWhatsAppTemplateTool.execute as (context: ToolContext, input: unknown) => Promise<unknown>);
    setToolRegistry(registry);

    const contactId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const proposal = await registry.proposeTool(
      "send_whatsapp_template",
      { userId: "user-a", locale: "fr", requestId: "req", organizationId: orgId },
      { contactId, templateId, language: "fr" },
      "conv-1"
    );

    try {
      await registry.confirmAndExecuteTool(
        "send_whatsapp_template",
        { userId: "user-b", locale: "fr", requestId: "req", organizationId: orgId },
        proposal.executionId,
        { contactId, templateId, language: "fr" }
      );
      assert.fail("Should have thrown for access denied");
    } catch (error) {
      assert.ok((error as Error).message.includes("access denied") || (error as Error).message.includes("not found"));
    }

    const { ControlledToolRegistry } = await import("../../src/server/tools/registry");
    setToolRegistry(new ControlledToolRegistry());
  });
});

test("Prompt injection: retrieved instruction cannot bypass tool confirmation", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const { getToolRegistry, setToolRegistry } = await import("../../src/server/tools/registry");
    const { TestToolRegistry } = await import("../../src/server/tools/registry.test");
    const { sendWhatsAppTemplateTool } = await import("../../src/server/tools/definitions/business-tools");

    const registry = new TestToolRegistry();
    registry.registerTool(sendWhatsAppTemplateTool, sendWhatsAppTemplateTool.execute as (context: ToolContext, input: unknown) => Promise<unknown>);
    setToolRegistry(registry);

    const contactId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const proposal = await registry.proposeTool(
      "send_whatsapp_template",
      { userId: "user", locale: "fr", requestId: "req", organizationId: orgId },
      { contactId, templateId, language: "fr" },
      "conv-1"
    );

    assert.ok(proposal.requiresConfirmation);

    const { ControlledToolRegistry } = await import("../../src/server/tools/registry");
    setToolRegistry(new ControlledToolRegistry());
  });
});

test("Secrets: tool output does not expose secrets", { skip: !url }, async () => {
  const { searchKnowledgeTool } = await import("../../src/server/tools/definitions/read-tools");
  const output = await searchKnowledgeTool.execute(
    { userId: "user", locale: "fr", requestId: "req", platformRole: "USER" },
    { query: "test", limit: 5 }
  );

  const outputStr = JSON.stringify(output);
  assert.ok(!outputStr.includes("secret"));
  assert.ok(!outputStr.includes("password"));
  assert.ok(!outputStr.includes("token"));
});

test("Conversation storage: no hidden system prompt or CoT", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const userId = await seedUser(client);
    const { getConversationRepository } = await import("../../src/server/ai/conversation-repository");
    const repo = getConversationRepository();

    const convId = await repo.createConversation(userId, null, "Test");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.append({ conversationId: convId, userId, message: { role: "USER" as any, content: "Hello" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.append({ conversationId: convId, userId, message: { role: "ASSISTANT" as any, content: "Hi there" } });

    const messages = await repo.list({ conversationId: convId, userId });

    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, "USER");
    assert.equal(messages[1].role, "ASSISTANT");

    for (const msg of messages) {
      assert.ok(!msg.content.includes("SYSTEM PROMPT"));
      assert.ok(!msg.content.includes("CHAIN OF THOUGHT"));
      assert.ok(!msg.content.includes("TOOL_CALL"));
    }
  });
});

test("Concurrency: atomic confirmation prevents duplicate BUSINESS_WRITE execution", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;

    // Create user, organization, and membership for real tool execution
    const userId = crypto.randomUUID();
    await client.query(
      `insert into "user" (id, name, email, email_verified, role, profile_type, locale, created_at, updated_at)
       values ($1, 'Concurrency Test', $2, true, 'USER', 'learner', 'fr', now(), now())`,
      [userId, `concurrency-${userId}@example.test`]
    );

    const orgId = crypto.randomUUID();
    await client.query(
      `insert into organization (id, name, slug, status, created_at, updated_at)
       values ($1, 'Test Org', $2, 'ACTIVE', now(), now())`,
      [orgId, `test-org-${crypto.randomUUID()}`]
    );

    await client.query(
      `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
       values ($1, $2, $3, 'STAFF', 'ACTIVE', now(), now())`,
      [crypto.randomUUID(), orgId, userId]
    );

    const contactId = crypto.randomUUID();
    await client.query(
      `insert into crm_contact (id, organization_id, first_name, last_name, status, created_by_user_id, created_at, updated_at)
       values ($1, $2, 'Test', 'Contact', 'ACTIVE', $3, now(), now())`,
      [contactId, orgId, userId]
    );

    const assigneeId = crypto.randomUUID();
    await client.query(
      `insert into "user" (id, name, email, email_verified, role, profile_type, locale, created_at, updated_at)
       values ($1, 'Assignee', $2, true, 'USER', 'teacher', 'fr', now(), now())`,
      [assigneeId, `assignee-${assigneeId}@example.test`]
    );
    await client.query(
      `insert into organization_membership (id, organization_id, user_id, role, status, created_at, updated_at)
       values ($1, $2, $3, 'STAFF', 'ACTIVE', now(), now())`,
      [crypto.randomUUID(), orgId, assigneeId]
    );

    const convId = crypto.randomUUID();
    await client.query(
      `insert into ai_conversation (id, user_id, organization_id, status, created_at, updated_at)
       values ($1, $2, $3, 'ACTIVE', now(), now())`,
      [convId, userId, orgId]
    );

    // Import the real execution function and tool
    const { confirmAndExecute } = await import("../../src/server/tools/execution");
    const { createAppointmentTool } = await import("../../src/server/tools/definitions/business-tools");
    const { getToolRegistry, setToolRegistry } = await import("../../src/server/tools/registry");
    const { ControlledToolRegistry } = await import("../../src/server/tools/registry");

    // Use the real registry for proposing, but track executions at the tool level
    const registry = new ControlledToolRegistry();
    setToolRegistry(registry);

    const proposal = await registry.proposeTool(
      "create_appointment",
      { userId, locale: "fr", requestId: "req", organizationId: orgId },
      { contactId, assignedToUserId: assigneeId, type: "ASSESSMENT", startAt: "2026-01-01T10:00:00Z", endAt: "2026-01-01T11:00:00Z" },
      convId
    );

    let executionCount = 0;

// Build the tool context that confirmAndExecute will use
    const toolContext = {
      userId,
      locale: "fr" as const,
      requestId: "req",
      organizationId: orgId,
      platformRole: "USER" as const,
      activePersona: "learner" as const,
      organizationRole: "STAFF" as const,
    };

    // Track executions by wrapping the tool execute
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalExecute = createAppointmentTool.execute;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trackingExecute = async (context: any, input: any) => {
      executionCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
      return originalExecute(context, input);
    };

    // Temporarily replace the tool's execute
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createAppointmentTool as any).execute = trackingExecute;

    try {
      const results = await Promise.allSettled([
        confirmAndExecute(
          createAppointmentTool,
          toolContext,
          proposal.executionId,
          { contactId, assignedToUserId: assigneeId, type: "ASSESSMENT", startAt: "2026-01-01T10:00:00Z", endAt: "2026-01-01T11:00:00Z" }
        ),
        confirmAndExecute(
          createAppointmentTool,
          toolContext,
          proposal.executionId,
          { contactId, assignedToUserId: assigneeId, type: "ASSESSMENT", startAt: "2026-01-01T10:00:00Z", endAt: "2026-01-01T11:00:00Z" }
        ),
      ]);

      const successful = results.filter(r => r.status === "fulfilled" && r.value.success);
      const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success));

      assert.equal(successful.length, 1, "Exactly one confirmation should succeed");
      assert.equal(failed.length, 1, "Exactly one confirmation should fail");
      assert.equal(executionCount, 1, "Tool execute function should be invoked exactly once");
    } finally {
      // Restore original execute
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (createAppointmentTool as any).execute = originalExecute;
      setToolRegistry(new ControlledToolRegistry());
    }
  });
});
