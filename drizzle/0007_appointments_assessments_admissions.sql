-- Phase 4: Appointments + Assessment/Admission workflow.
-- Extends the Phase 3 CRM foundation with an appointment funnel. An
-- appointment belongs to a CRM contact (never a user account); assessment and
-- admission rows carry the same organization_id as their parent contact via
-- composite FKs, making cross-organization references a DB-level impossibility.
-- See docs/premium/DATA_MODEL.md §5 and docs/premium/ROADMAP.md Phase 4.

-- (id, organization_id) unique on crm_contact enables the composite FKs used
-- by the Phase 4 tables below (a row in org A can never reference a contact in
-- org B at the DB level).
CREATE UNIQUE INDEX "crm_contact_id_org_unique" ON "crm_contact" USING btree ("id","organization_id");
--> statement-breakpoint

-- Bounded activity types extended for the Phase 4 funnel. Recreated (not
-- appended) so the constraint remains a single explicit allowlist.
ALTER TABLE "crm_contact_activity" DROP CONSTRAINT "crm_contact_activity_type_check";
--> statement-breakpoint
ALTER TABLE "crm_contact_activity" ADD CONSTRAINT "crm_contact_activity_type_check" CHECK ("crm_contact_activity"."type" in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED','APPOINTMENT_CREATED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','APPOINTMENT_COMPLETED','ASSESSMENT_CREATED','ASSESSMENT_COMPLETED','ADMISSION_ACCEPTED','ADMISSION_REJECTED'));
--> statement-breakpoint

-- A scheduled interaction with a prospect contact. contact_id is REQUIRED and
-- is the identity anchor: prospects precede ANEI accounts, so no linked user
-- is required here. assigned_to_user_id must always resolve to an active
-- organization member (enforced in the service layer).
CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"assigned_to_user_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"type" text DEFAULT 'ASSESSMENT' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"note" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "appointment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "appointment_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "appointment_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "appointment_contact_org_fk" FOREIGN KEY ("contact_id","organization_id") REFERENCES "public"."crm_contact"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "appointment_status_check" CHECK ("appointment"."status" in ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
	CONSTRAINT "appointment_type_check" CHECK ("appointment"."type" in ('ASSESSMENT','INFO_MEETING','FOLLOW_UP','OTHER')),
	CONSTRAINT "appointment_time_range_check" CHECK ("appointment"."end_at" > "appointment"."start_at")
);
--> statement-breakpoint
-- (id, organization_id) unique enables the composite assessment FK below.
CREATE UNIQUE INDEX "appointment_id_org_unique" ON "appointment" USING btree ("id","organization_id");
--> statement-breakpoint
CREATE INDEX "appointment_org_start_idx" ON "appointment" USING btree ("organization_id","start_at");
--> statement-breakpoint
CREATE INDEX "appointment_assignee_start_idx" ON "appointment" USING btree ("assigned_to_user_id","start_at");
--> statement-breakpoint
CREATE INDEX "appointment_contact_idx" ON "appointment" USING btree ("contact_id");
--> statement-breakpoint

-- Append-only history for each appointment. No updates, no deletes: the full
-- reschedule/status trail lives here for auditability.
CREATE TABLE "appointment_event" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"actor_user_id" text,
	"event_type" text NOT NULL,
	"previous_status" text,
	"new_status" text,
	"previous_start_at" timestamp with time zone,
	"new_start_at" timestamp with time zone,
	"previous_end_at" timestamp with time zone,
	"new_end_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "appointment_event_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "appointment_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "appointment_event_type_check" CHECK ("appointment_event"."event_type" in ('CREATED','RESCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'))
);
--> statement-breakpoint
CREATE INDEX "appointment_event_appointment_idx" ON "appointment_event" USING btree ("appointment_id","created_at");
--> statement-breakpoint

-- An assessment performed during an appointment (or standalone). Not medical:
-- a training/admission-positioning outcome with a bounded score. A completed
-- assessment is immutable (no UPDATE path in the service layer).
CREATE TABLE "assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"appointment_id" text,
	"assessor_user_id" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"score" integer,
	"max_score" integer,
	"summary" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "assessment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "assessment_assessor_user_id_user_id_fk" FOREIGN KEY ("assessor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "assessment_contact_org_fk" FOREIGN KEY ("contact_id","organization_id") REFERENCES "public"."crm_contact"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "assessment_appointment_org_fk" FOREIGN KEY ("appointment_id","organization_id") REFERENCES "public"."appointment"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "assessment_status_check" CHECK ("assessment"."status" in ('DRAFT','COMPLETED'))
);
--> statement-breakpoint
-- (id, organization_id) unique enables the composite admission FK below.
CREATE UNIQUE INDEX "assessment_id_org_unique" ON "assessment" USING btree ("id","organization_id");
--> statement-breakpoint
CREATE INDEX "assessment_org_contact_idx" ON "assessment" USING btree ("organization_id","contact_id");
--> statement-breakpoint
CREATE INDEX "assessment_appointment_idx" ON "assessment" USING btree ("appointment_id");
--> statement-breakpoint

-- The admission decision for a contact, informed by an optional assessment.
-- Starts PENDING and is finalized to ACCEPTED/REJECTED exactly once; the
-- invitation boundary (creating the ANEI user account) is OUT OF SCOPE here
-- and handled in a later phase.
CREATE TABLE "admission" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"assessment_id" text,
	"decision" text DEFAULT 'PENDING' NOT NULL,
	"decided_by_user_id" text,
	"reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admission_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "admission_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "admission_contact_org_fk" FOREIGN KEY ("contact_id","organization_id") REFERENCES "public"."crm_contact"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "admission_assessment_org_fk" FOREIGN KEY ("assessment_id","organization_id") REFERENCES "public"."assessment"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "admission_decision_check" CHECK ("admission"."decision" in ('PENDING','ACCEPTED','REJECTED'))
);
--> statement-breakpoint
CREATE INDEX "admission_org_decision_idx" ON "admission" USING btree ("organization_id","decision");
--> statement-breakpoint
CREATE INDEX "admission_contact_idx" ON "admission" USING btree ("contact_id");