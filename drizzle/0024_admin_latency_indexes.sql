-- Supports the admin dashboard overview/growth aggregations
-- (src/modules/admin/queries/admin-analytics.ts), which filter/group on
-- these columns with no prior supporting index.
CREATE INDEX "enrollment_status_idx" ON "enrollments" ("status");
CREATE INDEX "payments_status_created_idx" ON "payments" ("status", "created_at");
CREATE INDEX "user_created_at_idx" ON "user" ("created_at");
