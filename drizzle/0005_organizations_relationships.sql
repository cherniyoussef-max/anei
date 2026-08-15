-- Phase 2: organizations, organization memberships, and cross-user
-- relationship/assignment tables (parent<->student, AVS<->student,
-- specialist<->student). Additive only — no existing table is modified.
-- See docs/premium/DATA_MODEL.md §2-§3 and docs/premium/ROADMAP.md Phase 2.

CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_status_check" CHECK ("organization"."status" in ('ACTIVE','SUSPENDED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_unique" ON "organization" USING btree ("slug");
--> statement-breakpoint

CREATE TABLE "organization_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_membership_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "organization_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "organization_membership_role_check" CHECK ("organization_membership"."role" in ('OWNER','MANAGER','STAFF','VIEWER')),
	CONSTRAINT "organization_membership_status_check" CHECK ("organization_membership"."status" in ('ACTIVE','REVOKED'))
);
--> statement-breakpoint
-- Prevents duplicate ACTIVE memberships for the same user/organization pair
-- (a REVOKED row can still exist alongside a later ACTIVE one).
CREATE UNIQUE INDEX "organization_membership_active_unique" ON "organization_membership" USING btree ("organization_id","user_id") WHERE "organization_membership"."status" = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX "organization_membership_org_idx" ON "organization_membership" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "organization_membership_user_idx" ON "organization_membership" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE "parent_student_link" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_user_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"relationship_type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "parent_student_link_parent_user_id_user_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "parent_student_link_student_user_id_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "parent_student_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "parent_student_link_self_check" CHECK ("parent_student_link"."parent_user_id" != "parent_student_link"."student_user_id"),
	CONSTRAINT "parent_student_link_relationship_type_check" CHECK ("parent_student_link"."relationship_type" in ('MOTHER','FATHER','GUARDIAN','OTHER')),
	CONSTRAINT "parent_student_link_status_check" CHECK ("parent_student_link"."status" in ('PENDING','ACTIVE','REVOKED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "parent_student_link_unique" ON "parent_student_link" USING btree ("parent_user_id","student_user_id");
--> statement-breakpoint
CREATE INDEX "parent_student_link_parent_idx" ON "parent_student_link" USING btree ("parent_user_id");
--> statement-breakpoint
CREATE INDEX "parent_student_link_student_idx" ON "parent_student_link" USING btree ("student_user_id");
--> statement-breakpoint

-- Deliberately separate from avs_profiles (the existing public directory/
-- profile model) — see docs/premium/ROADMAP.md Phase 2 §E.
CREATE TABLE "avs_student_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"avs_user_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "avs_student_assignment_avs_user_id_user_id_fk" FOREIGN KEY ("avs_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "avs_student_assignment_student_user_id_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "avs_student_assignment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "avs_student_assignment_self_check" CHECK ("avs_student_assignment"."avs_user_id" != "avs_student_assignment"."student_user_id"),
	CONSTRAINT "avs_student_assignment_status_check" CHECK ("avs_student_assignment"."status" in ('ACTIVE','ENDED'))
);
--> statement-breakpoint
-- At most one ACTIVE assignment per avs/student pair; ENDED rows are kept
-- for history (never destructively replaced).
CREATE UNIQUE INDEX "avs_student_assignment_active_unique" ON "avs_student_assignment" USING btree ("avs_user_id","student_user_id") WHERE "avs_student_assignment"."status" = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX "avs_student_assignment_avs_idx" ON "avs_student_assignment" USING btree ("avs_user_id","status");
--> statement-breakpoint
CREATE INDEX "avs_student_assignment_student_idx" ON "avs_student_assignment" USING btree ("student_user_id");
--> statement-breakpoint

CREATE TABLE "specialist_student_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"specialist_user_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "specialist_student_assignment_specialist_user_id_user_id_fk" FOREIGN KEY ("specialist_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "specialist_student_assignment_student_user_id_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "specialist_student_assignment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "specialist_student_assignment_self_check" CHECK ("specialist_student_assignment"."specialist_user_id" != "specialist_student_assignment"."student_user_id"),
	CONSTRAINT "specialist_student_assignment_status_check" CHECK ("specialist_student_assignment"."status" in ('ACTIVE','ENDED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "specialist_student_assignment_active_unique" ON "specialist_student_assignment" USING btree ("specialist_user_id","student_user_id") WHERE "specialist_student_assignment"."status" = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX "specialist_student_assignment_specialist_idx" ON "specialist_student_assignment" USING btree ("specialist_user_id","status");
--> statement-breakpoint
CREATE INDEX "specialist_student_assignment_student_idx" ON "specialist_student_assignment" USING btree ("student_user_id");
