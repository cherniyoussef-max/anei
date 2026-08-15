-- Phase 3: CRM foundation. Deliberately namespaced crm_* and kept separate
-- from contact_messages (public website contact-form submissions) and from
-- /admin/contacts. A CRM contact is not a user account: linked_user_id is
-- always optional and no credential/session fields exist here.
-- See docs/premium/DATA_MODEL.md §5 and docs/premium/ROADMAP.md Phase 3.

CREATE TABLE "crm_pipeline" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_pipeline_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_pipeline_org_name_unique" ON "crm_pipeline" USING btree ("organization_id","name");
--> statement-breakpoint
CREATE INDEX "crm_pipeline_org_idx" ON "crm_pipeline" USING btree ("organization_id");
--> statement-breakpoint

-- organization_id is denormalized from the parent pipeline so that
-- crm_contact.current_stage_id can carry a composite FK
-- (current_stage_id, organization_id) -> (id, organization_id), making a
-- contact referencing a stage from a foreign organization/pipeline a
-- DB-level impossibility.
CREATE TABLE "crm_pipeline_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_pipeline_stage_pipeline_id_crm_pipeline_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipeline"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crm_pipeline_stage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_pipeline_stage_id_org_unique" ON "crm_pipeline_stage" USING btree ("id","organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_pipeline_stage_pipeline_position_unique" ON "crm_pipeline_stage" USING btree ("pipeline_id","position");
--> statement-breakpoint
CREATE INDEX "crm_pipeline_stage_pipeline_idx" ON "crm_pipeline_stage" USING btree ("pipeline_id");
--> statement-breakpoint

CREATE TABLE "crm_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"linked_user_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"current_stage_id" text,
	"assigned_to_user_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "crm_contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crm_contact_linked_user_id_user_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "crm_contact_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "crm_contact_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "crm_contact_stage_org_fk" FOREIGN KEY ("current_stage_id","organization_id") REFERENCES "public"."crm_pipeline_stage"("id","organization_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "crm_contact_status_check" CHECK ("crm_contact"."status" in ('ACTIVE','ARCHIVED'))
);
--> statement-breakpoint
CREATE INDEX "crm_contact_org_idx" ON "crm_contact" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "crm_contact_stage_idx" ON "crm_contact" USING btree ("current_stage_id");
--> statement-breakpoint
CREATE INDEX "crm_contact_assignee_idx" ON "crm_contact" USING btree ("assigned_to_user_id");
--> statement-breakpoint
-- A user may be linked from at most one CRM contact per organization.
CREATE UNIQUE INDEX "crm_contact_org_linked_user_unique" ON "crm_contact" USING btree ("organization_id","linked_user_id") WHERE "crm_contact"."linked_user_id" is not null;
--> statement-breakpoint
CREATE INDEX "crm_contact_created_idx" ON "crm_contact" USING btree ("organization_id","created_at");
--> statement-breakpoint

CREATE TABLE "crm_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_tag_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_tag_org_name_unique" ON "crm_tag" USING btree ("organization_id","name");
--> statement-breakpoint
CREATE INDEX "crm_tag_org_idx" ON "crm_tag" USING btree ("organization_id");
--> statement-breakpoint

CREATE TABLE "crm_contact_tag" (
	"contact_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_contact_tag_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id"),
	CONSTRAINT "crm_contact_tag_contact_id_crm_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contact"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crm_contact_tag_tag_id_crm_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tag"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "crm_contact_tag_tag_idx" ON "crm_contact_tag" USING btree ("tag_id");
--> statement-breakpoint

CREATE TABLE "crm_contact_note" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_contact_note_contact_id_crm_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contact"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crm_contact_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "crm_contact_note_contact_idx" ON "crm_contact_note" USING btree ("contact_id","created_at");
--> statement-breakpoint

CREATE TABLE "crm_contact_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"actor_user_id" text,
	"type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crm_contact_activity_contact_id_crm_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contact"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crm_contact_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "crm_contact_activity_type_check" CHECK ("crm_contact_activity"."type" in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED'))
);
--> statement-breakpoint
CREATE INDEX "crm_contact_activity_contact_idx" ON "crm_contact_activity" USING btree ("contact_id","created_at");
