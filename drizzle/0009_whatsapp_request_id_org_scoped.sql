-- Scope the outbound idempotency key per-organization.
-- The previous global unique index on local_request_id created a cross-org
-- dependency: if organization B reused a requestId string that organization A
-- had already finalized, B's send was rejected with a spurious conflict (and,
-- before that, B's org-unsafe lookup could silently resolve to A's row).
-- Rebuild the index as (organization_id, local_request_id) so each
-- organization owns its own idempotency namespace.

DROP INDEX IF EXISTS "whatsapp_message_local_request_unique";

CREATE UNIQUE INDEX "whatsapp_message_local_request_unique"
  ON "whatsapp_message" ("organization_id", "local_request_id")
  WHERE "local_request_id" IS NOT NULL;