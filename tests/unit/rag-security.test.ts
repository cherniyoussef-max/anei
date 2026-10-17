import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveAllowedVisibilities,
  calculateRRF,
} from "@/server/ai/retriever";
import {
  checkAndConsumeAiQuota,
  AI_QUOTA_LIMITS,
} from "@/server/ai/meter";
import {
  buildPublicAssistantPrompt,
  buildTeacherAssistantPrompt,
  formatRetrievedContext,
} from "@/server/ai/prompts";
import { calculateJitteredTtl } from "@/server/cache/redis-cache";

test("RAG Security: resolveAllowedVisibilities strictly isolates Public vs Teacher roles", () => {
  // 1. Unauthenticated or general public user
  const guestVisibilities = resolveAllowedVisibilities({
    audience: "PUBLIC",
    role: "USER",
  });
  assert.deepEqual(guestVisibilities, ["PUBLIC"]);

  // 2. Parent or learner attempting to query teacher audience
  const parentAttempt = resolveAllowedVisibilities({
    audience: "TEACHER",
    role: "USER",
  });
  assert.deepEqual(
    parentAttempt,
    ["PUBLIC"],
    "Public/learner user must never receive TEACHER visibility, even if requested",
  );

  // 3. Verified Teacher
  const teacherVisibilities = resolveAllowedVisibilities({
    audience: "TEACHER",
    role: "teacher",
  });
  assert.ok(teacherVisibilities.includes("PUBLIC"));
  assert.ok(teacherVisibilities.includes("TEACHER"));
  assert.ok(teacherVisibilities.includes("PLATFORM"));
  assert.equal(teacherVisibilities.includes("ORGANIZATION"), false);

  // 4. Verified Specialist with Organization membership
  const specialistOrgVisibilities = resolveAllowedVisibilities({
    audience: "TEACHER",
    role: "specialist",
    isOrgMember: true,
  });
  assert.ok(specialistOrgVisibilities.includes("ORGANIZATION"));

  // 5. Admin role
  const adminVisibilities = resolveAllowedVisibilities({
    audience: "TEACHER",
    role: "ADMIN",
  });
  assert.ok(adminVisibilities.includes("TEACHER"));
});

test("RAG Security: Reciprocal Rank Fusion (RRF) scores items with agreement higher", () => {
  const vectorRanks = new Map<string, number>([
    ["doc-both", 1],
    ["doc-vector-only", 2],
    ["doc-text-only", 10],
  ]);

  const textRanks = new Map<string, number>([
    ["doc-both", 1],
    ["doc-text-only", 2],
    ["doc-vector-only", 10],
  ]);

  const rrfScores = calculateRRF(vectorRanks, textRanks, 60);

  const scoreBoth = rrfScores.get("doc-both")!;
  const scoreVectorOnly = rrfScores.get("doc-vector-only")!;
  const scoreTextOnly = rrfScores.get("doc-text-only")!;

  assert.ok(scoreBoth > scoreVectorOnly, "High agreement in both vector and text must score highest");
  assert.ok(scoreBoth > scoreTextOnly);
  assert.equal(scoreBoth, 1 / 61 + 1 / 61);
});

test("RAG Security: Token-drain protection rate limits public guests", async () => {
  const testIp = "198.51.100.42";
  const testUa = "Mozilla/5.0 TestBrowser";

  // Consume up to limit (10 for public guest)
  const results = [];
  for (let i = 0; i < AI_QUOTA_LIMITS.PUBLIC_GUEST.maxRequestsPerMinute; i++) {
    results.push(
      await checkAndConsumeAiQuota({
        audience: "PUBLIC",
        ip: testIp,
        userAgent: testUa,
      }),
    );
  }

  // All within limit should be allowed
  assert.ok(results.every((r) => r.allowed));

  // The 11th request must be rejected with 429 semantics
  const deniedResult = await checkAndConsumeAiQuota({
    audience: "PUBLIC",
    ip: testIp,
    userAgent: testUa,
  });

  assert.equal(deniedResult.allowed, false);
  assert.ok((deniedResult.retryAfterSeconds ?? 0) > 0);
});

test("RAG Security: Teacher Assistant requires authenticated user ID", async () => {
  const unauthedCheck = await checkAndConsumeAiQuota({
    audience: "TEACHER",
    userId: null,
  });

  assert.equal(unauthedCheck.allowed, false);
  assert.match(unauthedCheck.reason ?? "", /Authentication required/);
});

test("RAG Guardrails: Prompts contain strict non-hallucination and medical boundaries", () => {
  const mockChunks = [
    {
      id: "chunk-1",
      documentId: "doc-1",
      chunkIndex: 0,
      text: "L'ANEI propose des accompagnants scolaires qualifiés.",
      visibility: "PUBLIC",
      language: "fr",
      score: 0.95,
      source: "catalogue",
      title: "Guide AVS ANEI",
    },
  ];

  const formattedContext = formatRetrievedContext(mockChunks);
  assert.match(formattedContext, /Guide AVS ANEI/);
  assert.match(formattedContext, /chunk-1/);

  // French Public Prompt
  const frPrompt = buildPublicAssistantPrompt("fr", mockChunks);
  assert.match(frPrompt, /INTERDICTION ABSOLUE DU DIAGNOSTIC MÉDICAL/);
  assert.match(frPrompt, /ZÉRO HALLUCINATION/);
  assert.match(frPrompt, /Guide AVS ANEI/);

  // Arabic Public Prompt
  const arPrompt = buildPublicAssistantPrompt("ar", mockChunks);
  assert.match(arPrompt, /منع التشخيص الطبي/);
  assert.match(arPrompt, /الدقة والنزاهة/);

  // Teacher Prompts
  const frTeacherPrompt = buildTeacherAssistantPrompt("fr", mockChunks);
  assert.match(frTeacherPrompt, /Conseiller Pédagogique Spécialisé/);
  assert.match(frTeacherPrompt, /PAI, PPS, GEVA-Sco/);

  const arTeacherPrompt = buildTeacherAssistantPrompt("ar", mockChunks);
  assert.match(arTeacherPrompt, /المستشار البيداغوجي/);
});

test("Scalability: calculateJitteredTtl bounds jitter within ratio", () => {
  const baseTtl = 3600;
  const ratio = 0.15; // +/- 15% -> [3060, 4140]

  for (let i = 0; i < 50; i++) {
    const jittered = calculateJitteredTtl(baseTtl, ratio);
    assert.ok(jittered >= 3060, `Jittered TTL ${jittered} should be >= 3060`);
    assert.ok(jittered <= 4140, `Jittered TTL ${jittered} should be <= 4140`);
  }
});
