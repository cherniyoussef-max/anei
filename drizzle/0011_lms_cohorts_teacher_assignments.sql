-- Phase 7: LMS cohorts, teacher-course assignments, enrollment source
-- tracking. `enrollments.source` is additive descriptive metadata only --
-- every existing entitlement check (hasEntitlement, getLearningCourse)
-- continues to check only for the presence of an enrollments row, not its
-- source, so existing paid-course access is unaffected. Cohort membership
-- references an enrollment rather than duplicating student/course truth: the
-- partial UNIQUE on cohort_membership.enrollment_id guarantees at most one
-- cohort per enrollment. teacher_course_assignment follows the same
-- shape/semantics as avs_student_assignment/specialist_student_assignment
-- (admin/org-manager-only, history-preserving via ON DELETE restrict, at
-- most one ACTIVE assignment per teacher/course pair). See
-- docs/premium/ROADMAP.md Phase 7, DATA_MODEL.md §4/§8.

ALTER TABLE "enrollments" ADD COLUMN "source" text DEFAULT 'PAYMENT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollment_source_check" CHECK ("enrollments"."source" in ('PAYMENT','TEST_PASS','ORGANIZATION','ADMIN','MANUAL'));
--> statement-breakpoint
CREATE INDEX "enrollment_course_idx" ON "enrollments" USING btree ("course_id");
--> statement-breakpoint

CREATE TABLE "cohort" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"capacity" integer,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "cohort_status_check" CHECK ("cohort"."status" in ('DRAFT','ACTIVE','CLOSED','ARCHIVED')),
	CONSTRAINT "cohort_capacity_positive" CHECK ("cohort"."capacity" is null or "cohort"."capacity" > 0),
	CONSTRAINT "cohort_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "cohort_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "cohort_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "cohort_org_course_idx" ON "cohort" USING btree ("organization_id","course_id");
--> statement-breakpoint
CREATE INDEX "cohort_course_idx" ON "cohort" USING btree ("course_id");
--> statement-breakpoint

CREATE TABLE "cohort_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"cohort_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "cohort_membership_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "cohort_membership_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_membership_cohort_enrollment_unique" ON "cohort_membership" USING btree ("cohort_id","enrollment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_membership_enrollment_unique" ON "cohort_membership" USING btree ("enrollment_id");
--> statement-breakpoint
CREATE INDEX "cohort_membership_cohort_idx" ON "cohort_membership" USING btree ("cohort_id");
--> statement-breakpoint

CREATE TABLE "teacher_course_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"organization_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "teacher_course_assignment_status_check" CHECK ("teacher_course_assignment"."status" in ('ACTIVE','ENDED')),
	CONSTRAINT "teacher_course_assignment_teacher_user_id_user_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "teacher_course_assignment_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "teacher_course_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "teacher_course_assignment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_course_assignment_active_unique" ON "teacher_course_assignment" USING btree ("teacher_user_id","course_id") WHERE "teacher_course_assignment"."status" = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX "teacher_course_assignment_teacher_idx" ON "teacher_course_assignment" USING btree ("teacher_user_id","status");
--> statement-breakpoint
CREATE INDEX "teacher_course_assignment_course_idx" ON "teacher_course_assignment" USING btree ("course_id");
--> statement-breakpoint

-- Bounded activity types extended for the Phase 7 enrollment event. Recreated
-- (not appended), matching the Phase 5/6 migration convention.
ALTER TABLE "crm_contact_activity" DROP CONSTRAINT "crm_contact_activity_type_check";
--> statement-breakpoint
ALTER TABLE "crm_contact_activity" ADD CONSTRAINT "crm_contact_activity_type_check" CHECK ("crm_contact_activity"."type" in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED','APPOINTMENT_CREATED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','APPOINTMENT_COMPLETED','ASSESSMENT_CREATED','ASSESSMENT_COMPLETED','ADMISSION_ACCEPTED','ADMISSION_REJECTED','WHATSAPP_TEMPLATE_SENT','WHATSAPP_MESSAGE_RECEIVED','WHATSAPP_FAILED','ACCOUNT_INVITATION_SENT','PHONE_VERIFIED','ACCOUNT_LINKED','ACCOUNT_INVITATION_REVOKED','COURSE_ENROLLED'));
