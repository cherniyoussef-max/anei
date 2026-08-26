-- Supports src/server/queries/admin.ts's searchAuditLogs, which orders/paginates
-- the whole (append-only, unbounded-growth) audit_logs table by created_at with
-- no prior supporting index, forcing a full-table sort on every page.
-- Local EXPLAIN (ANALYZE, BUFFERS) at 50k synthetic rows: 5.955ms Seq Scan + sort
-- vs 0.974ms Index Scan for `ORDER BY created_at DESC LIMIT 30 OFFSET 5000`
-- (a plain ascending btree, matching every other index in this schema, is
-- scanned backwards by Postgres for DESC ordering just as efficiently).
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
