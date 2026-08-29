-- Persona-specific profile tables (professional personas only). Additive,
-- backward-compatible: existing accounts continue to work with no row here
-- (all columns nullable, all onboarding/dashboard reads treat a missing row
-- as "no professional profile yet" rather than an error). Each table is
-- owned by persona_membership.id (not user_id directly) so one account
-- holding both TEACHER and SPECIALIST personas gets two independent rows
-- that can never collide - UNIQUE(persona_membership_id) guarantees at most
-- one profile row per membership, and ON DELETE cascade mirrors
-- persona_membership's own cascade from "user". The FK alone cannot express
-- "this row must belong to a membership whose persona = TEACHER" - that is
-- enforced in the owning service (src/server/services/persona-profiles.ts),
-- not at the database level, matching the pattern already used for
-- assignment tables like teacher_course_assignment above.
CREATE TABLE "teacher_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"persona_membership_id" text NOT NULL,
	"discipline" text,
	"qualification" text,
	"experience_years" integer,
	"levels_taught" text[],
	"professional_institution" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "teacher_profile_experience_years_check" CHECK ("teacher_profile"."experience_years" is null or ("teacher_profile"."experience_years" >= 0 and "teacher_profile"."experience_years" <= 80)),
	CONSTRAINT "teacher_profile_persona_membership_id_persona_membership_id_fk" FOREIGN KEY ("persona_membership_id") REFERENCES "public"."persona_membership"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_profile_membership_unique" ON "teacher_profile" USING btree ("persona_membership_id");
--> statement-breakpoint

CREATE TABLE "avs_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"persona_membership_id" text NOT NULL,
	"qualification" text,
	"experience_years" integer,
	"intervention_domains" text[],
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "avs_profile_experience_years_check" CHECK ("avs_profile"."experience_years" is null or ("avs_profile"."experience_years" >= 0 and "avs_profile"."experience_years" <= 80)),
	CONSTRAINT "avs_profile_persona_membership_id_persona_membership_id_fk" FOREIGN KEY ("persona_membership_id") REFERENCES "public"."persona_membership"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "avs_profile_membership_unique" ON "avs_profile" USING btree ("persona_membership_id");
--> statement-breakpoint

CREATE TABLE "specialist_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"persona_membership_id" text NOT NULL,
	"specialty" text,
	"qualification" text,
	"experience_years" integer,
	"practice_structure" text,
	"intervention_domains" text[],
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "specialist_profile_experience_years_check" CHECK ("specialist_profile"."experience_years" is null or ("specialist_profile"."experience_years" >= 0 and "specialist_profile"."experience_years" <= 80)),
	CONSTRAINT "specialist_profile_persona_membership_id_persona_membership_id_fk" FOREIGN KEY ("persona_membership_id") REFERENCES "public"."persona_membership"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "specialist_profile_membership_unique" ON "specialist_profile" USING btree ("persona_membership_id");
--> statement-breakpoint

-- Pre-approval ORGANIZATION-persona application data only - deliberately NOT
-- the authoritative organization/organization_membership entities (see
-- src/server/services/organizations.ts). Holding the ORGANIZATION persona
-- never grants organization access by itself.
CREATE TABLE "organization_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"persona_membership_id" text NOT NULL,
	"organization_name" text,
	"organization_type" text,
	"representative_role" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_profile_persona_membership_id_persona_membership_id_fk" FOREIGN KEY ("persona_membership_id") REFERENCES "public"."persona_membership"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_profile_membership_unique" ON "organization_profile" USING btree ("persona_membership_id");
