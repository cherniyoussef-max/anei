-- Indexes aligned with the public discovery and operations queries.
-- ILIKE '%term%' remains deliberately unindexed at this scale; adopt pg_trgm
-- only after measured search latency justifies the operational dependency.
CREATE INDEX "courses_published_created_idx" ON "courses" ("published", "created_at" DESC);
CREATE INDEX "courses_published_price_idx" ON "courses" ("published", "price_millimes");
CREATE INDEX "resources_published_created_idx" ON "resources" ("published", "created_at" DESC);
CREATE INDEX "resources_published_type_idx" ON "resources" ("published", "type");
CREATE INDEX "orders_status_created_idx" ON "orders" ("status", "created_at" DESC);
CREATE INDEX "orders_user_created_idx" ON "orders" ("user_id", "created_at" DESC);
CREATE INDEX "webinars_published_starts_idx" ON "webinars" ("published", "starts_at");
CREATE INDEX "avs_visible_certified_idx" ON "avs_profiles" ("visible", "certified");
