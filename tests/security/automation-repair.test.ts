import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("docker-compose NODES_EXCLUDE uses JSON array encoding and excludes executeCommand", async () => {
  const source = await readFile("docker-compose.yml", "utf8");
  const match = source.match(/NODES_EXCLUDE:\s*'([^']+)'/);
  assert.ok(match, "NODES_EXCLUDE must be present and single-quoted JSON");

  const parsed = JSON.parse(match[1]) as string[];
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.includes("n8n-nodes-base.executeCommand"));
  assert.ok(parsed.includes("n8n-nodes-base.executeWorkflow"));
  assert.ok(parsed.includes("n8n-nodes-base.ssh"));
  assert.ok(parsed.includes("n8n-nodes-base.sftp"));
  assert.ok(parsed.includes("n8n-nodes-base.ftp"));
  assert.ok(parsed.includes("n8n-nodes-base.readBinaryFiles"));
  assert.ok(parsed.includes("n8n-nodes-base.readWriteFile"));
  assert.ok(parsed.includes("n8n-nodes-base.s3"));
});

test("workflow exports use native webhook auth and service token variable", async () => {
  for (const file of [
    "n8n/workflows/appointment-reminder.json",
    "n8n/workflows/onboarding-followup.json",
    "n8n/workflows/teacher-notification.json",
    "n8n/workflows/knowledge-sync.json",
  ]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /"authentication"\s*:\s*"headerAuth"/);
    assert.match(source, /N8N_ANEI_SERVICE_TOKEN/);
    assert.ok(!source.includes("ANEI_INTERNAL_TOKEN"));
  }
});

test("onboarding workflow idempotency key is stable and not Date.now", async () => {
  const source = await readFile("n8n/workflows/onboarding-followup.json", "utf8");
  assert.ok(!source.includes("Date.now()"));
  assert.match(source, /automation:onboarding-followup:/);
  assert.match(source, /automationExecutionId/);
});

test("legacy getWorkflowStatus stub is absent from automation runtime", async () => {
  const source = await readFile("src/server/automation/contracts.ts", "utf8");
  assert.ok(!source.includes("getWorkflowStatus"));
});
