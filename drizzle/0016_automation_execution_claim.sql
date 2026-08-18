-- Phase 10E security/reliability repair (post-review). Additive only. --
--
-- automation_execution gains RUNNING (claimed by exactly one n8n execution via
-- an atomic conditional UPDATE) and FAILED (terminal workflow failure) states,
-- plus claim bookkeeping columns. The CHECK constraint is dropped and
-- recreated with the extended state set; 0015 is untouched.

ALTER TABLE "automation_execution" DROP CONSTRAINT "automation_execution_status_check";
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD CONSTRAINT "automation_execution_status_check"
  CHECK ("automation_execution"."status" in ('PENDING','DISPATCHED','RUNNING','SUCCEEDED','FAILED','FAILED_TO_DISPATCH','WORKFLOW_FAILED'));
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD COLUMN "started_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD COLUMN "completed_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "automation_execution" ADD COLUMN "claimed_by" text;
