import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("audit_logs has an index supporting searchAuditLogs' ORDER BY created_at pagination, declared in both the migration and the Drizzle schema", async () => {
  const [migration, schema] = await Promise.all([
    readFile("drizzle/0025_audit_logs_created_at_index.sql", "utf8"),
    readFile("src/server/db/schema.ts", "utf8"),
  ]);
  assert.match(migration, /CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" \("created_at"\)/);

  const auditLogsStart = schema.indexOf('export const auditLogs = pgTable(\n  "audit_logs"');
  assert.ok(auditLogsStart > -1);
  const auditLogsEnd = schema.indexOf("\nexport const", auditLogsStart + 1);
  const auditLogsBody = schema.slice(auditLogsStart, auditLogsEnd);
  assert.equal(auditLogsBody.includes('index("audit_logs_created_at_idx").on(table.createdAt)'), true);
});
