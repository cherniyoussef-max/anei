-- ANEI production baseline generated from the verified Drizzle schema.
-- Apply through `npm run db:migrate`; do not edit after deployment.

CREATE TABLE "account" (
        "id" text PRIMARY KEY NOT NULL,
        "account_id" text NOT NULL,
        "provider_id" text NOT NULL,
        "user_id" text NOT NULL,
        "access_token" text,
        "refresh_token" text,
        "id_token" text,
        "access_token_expires_at" timestamp with time zone,
        "refresh_token_expires_at" timestamp with time zone,
        "scope" text,
        "password" text,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "audit_logs" (
        "id" text PRIMARY KEY NOT NULL,
        "actor_user_id" text,
        "action" text NOT NULL,
        "entity_type" text NOT NULL,
        "entity_id" text,
        "metadata" jsonb,
        "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "avs_profiles" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text,
        "display_name" text NOT NULL,
        "city_fr" text NOT NULL,
        "city_ar" text NOT NULL,
        "specialty_fr" text NOT NULL,
        "specialty_ar" text NOT NULL,
        "availability_fr" text NOT NULL,
        "availability_ar" text NOT NULL,
        "bio_fr" text DEFAULT '' NOT NULL,
        "bio_ar" text DEFAULT '' NOT NULL,
        "certified" boolean DEFAULT false NOT NULL,
        "visible" boolean DEFAULT true NOT NULL,
        "image" text,
        "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "certificates" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "course_id" text NOT NULL,
        "code" text NOT NULL,
        "file_url" text,
        "issued_at" timestamp with time zone NOT NULL
);

CREATE TABLE "contact_messages" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "subject" text NOT NULL,
        "message" text NOT NULL,
        "status" text DEFAULT 'new' NOT NULL,
        "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "courses" (
        "id" text PRIMARY KEY NOT NULL,
        "slug" text NOT NULL,
        "title_fr" text NOT NULL,
        "title_ar" text NOT NULL,
        "summary_fr" text NOT NULL,
        "summary_ar" text NOT NULL,
        "description_fr" text NOT NULL,
        "description_ar" text NOT NULL,
        "category" text NOT NULL,
        "level" text DEFAULT 'beginner' NOT NULL,
        "mode" text DEFAULT 'online' NOT NULL,
        "trainer_name" text NOT NULL,
        "duration_minutes" integer NOT NULL,
        "price_millimes" integer DEFAULT 0 NOT NULL,
        "start_at" timestamp with time zone,
        "cover_image" text,
        "published" boolean DEFAULT false NOT NULL,
        "featured" boolean DEFAULT false NOT NULL,
        "objectives" jsonb NOT NULL,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "enrollments" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "course_id" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "progress_percent" integer DEFAULT 0 NOT NULL,
        "enrolled_at" timestamp with time zone NOT NULL,
        "completed_at" timestamp with time zone
);

CREATE TABLE "lesson_progress" (
        "id" text PRIMARY KEY NOT NULL,
        "enrollment_id" text NOT NULL,
        "lesson_id" text NOT NULL,
        "watched_seconds" integer DEFAULT 0 NOT NULL,
        "completed" boolean DEFAULT false NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "lessons" (
        "id" text PRIMARY KEY NOT NULL,
        "course_id" text NOT NULL,
        "position" integer NOT NULL,
        "title_fr" text NOT NULL,
        "title_ar" text NOT NULL,
        "description_fr" text DEFAULT '' NOT NULL,
        "description_ar" text DEFAULT '' NOT NULL,
        "duration_seconds" integer DEFAULT 0 NOT NULL,
        "video_url" text,
        "document_url" text,
        "preview" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "news_posts" (
        "id" text PRIMARY KEY NOT NULL,
        "slug" text NOT NULL,
        "tag_fr" text NOT NULL,
        "tag_ar" text NOT NULL,
        "title_fr" text NOT NULL,
        "title_ar" text NOT NULL,
        "excerpt_fr" text NOT NULL,
        "excerpt_ar" text NOT NULL,
        "content_fr" text NOT NULL,
        "content_ar" text NOT NULL,
        "published" boolean DEFAULT false NOT NULL,
        "published_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "newsletter_subscriptions" (
        "id" text PRIMARY KEY NOT NULL,
        "email" text NOT NULL,
        "locale" text DEFAULT 'fr' NOT NULL,
        "active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "notifications" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "href" text,
        "read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "orders" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "item_type" text NOT NULL,
        "item_id" text NOT NULL,
        "item_label" text NOT NULL,
        "amount_millimes" integer NOT NULL,
        "currency" text DEFAULT 'TND' NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "provider" text DEFAULT 'mock' NOT NULL,
        "idempotency_key" text NOT NULL,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "payments" (
        "id" text PRIMARY KEY NOT NULL,
        "order_id" text NOT NULL,
        "provider" text NOT NULL,
        "external_payment_id" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "amount_millimes" integer NOT NULL,
        "checkout_url" text,
        "raw" jsonb,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "purchases" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "order_id" text NOT NULL,
        "resource_id" text,
        "granted_at" timestamp with time zone NOT NULL
);

CREATE TABLE "rateLimit" (
        "id" text PRIMARY KEY NOT NULL,
        "key" text NOT NULL,
        "count" integer NOT NULL,
        "last_request" bigint NOT NULL
);

CREATE TABLE "resources" (
        "id" text PRIMARY KEY NOT NULL,
        "slug" text NOT NULL,
        "title_fr" text NOT NULL,
        "title_ar" text NOT NULL,
        "description_fr" text NOT NULL,
        "description_ar" text NOT NULL,
        "audience_fr" text NOT NULL,
        "audience_ar" text NOT NULL,
        "type" text NOT NULL,
        "price_millimes" integer NOT NULL,
        "cover_image" text,
        "download_url" text,
        "published" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "session" (
        "id" text PRIMARY KEY NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "token" text NOT NULL,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL,
        "ip_address" text,
        "user_agent" text,
        "user_id" text NOT NULL
);

CREATE TABLE "user" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "email_verified" boolean DEFAULT false NOT NULL,
        "image" text,
        "role" text DEFAULT 'USER' NOT NULL,
        "locale" text DEFAULT 'fr' NOT NULL,
        "profile_type" text DEFAULT 'learner' NOT NULL,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "verification" (
        "id" text PRIMARY KEY NOT NULL,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone NOT NULL,
        "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "webinar_registrations" (
        "id" text PRIMARY KEY NOT NULL,
        "webinar_id" text NOT NULL,
        "user_id" text NOT NULL,
        "registered_at" timestamp with time zone NOT NULL
);

CREATE TABLE "webinars" (
        "id" text PRIMARY KEY NOT NULL,
        "slug" text NOT NULL,
        "title_fr" text NOT NULL,
        "title_ar" text NOT NULL,
        "description_fr" text NOT NULL,
        "description_ar" text NOT NULL,
        "trainer_name" text NOT NULL,
        "starts_at" timestamp with time zone NOT NULL,
        "duration_minutes" integer DEFAULT 60 NOT NULL,
        "meeting_url" text,
        "replay_url" text,
        "published" boolean DEFAULT true NOT NULL
);

ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "avs_profiles" ADD CONSTRAINT "avs_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_webinar_id_webinars_id_fk" FOREIGN KEY ("webinar_id") REFERENCES "public"."webinars"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");
CREATE UNIQUE INDEX "account_provider_unique" ON "account" USING btree ("provider_id","account_id");
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_user_id");
CREATE INDEX "avs_city_idx" ON "avs_profiles" USING btree ("city_fr");
CREATE INDEX "avs_certified_idx" ON "avs_profiles" USING btree ("certified");
CREATE UNIQUE INDEX "certificate_code_unique" ON "certificates" USING btree ("code");
CREATE INDEX "contact_status_idx" ON "contact_messages" USING btree ("status");
CREATE UNIQUE INDEX "courses_slug_unique" ON "courses" USING btree ("slug");
CREATE INDEX "courses_category_idx" ON "courses" USING btree ("category");
CREATE INDEX "courses_published_idx" ON "courses" USING btree ("published");
CREATE UNIQUE INDEX "enrollment_user_course_unique" ON "enrollments" USING btree ("user_id","course_id");
CREATE INDEX "enrollment_user_idx" ON "enrollments" USING btree ("user_id");
CREATE UNIQUE INDEX "lesson_progress_unique" ON "lesson_progress" USING btree ("enrollment_id","lesson_id");
CREATE UNIQUE INDEX "lessons_course_position_unique" ON "lessons" USING btree ("course_id","position");
CREATE INDEX "lessons_course_idx" ON "lessons" USING btree ("course_id");
CREATE UNIQUE INDEX "news_posts_slug_unique" ON "news_posts" USING btree ("slug");
CREATE INDEX "news_posts_published_idx" ON "news_posts" USING btree ("published","published_at");
CREATE UNIQUE INDEX "newsletter_email_unique" ON "newsletter_subscriptions" USING btree ("email");
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");
CREATE UNIQUE INDEX "orders_user_idempotency_unique" ON "orders" USING btree ("user_id","idempotency_key");
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");
CREATE UNIQUE INDEX "payments_provider_external_unique" ON "payments" USING btree ("provider","external_payment_id");
CREATE UNIQUE INDEX "purchases_order_unique" ON "purchases" USING btree ("order_id");
CREATE INDEX "purchases_user_idx" ON "purchases" USING btree ("user_id");
CREATE UNIQUE INDEX "rate_limit_key_unique" ON "rateLimit" USING btree ("key");
CREATE UNIQUE INDEX "resources_slug_unique" ON "resources" USING btree ("slug");
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");
CREATE INDEX "session_expires_idx" ON "session" USING btree ("expires_at");
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
CREATE UNIQUE INDEX "webinar_registration_unique" ON "webinar_registrations" USING btree ("webinar_id","user_id");
CREATE UNIQUE INDEX "webinars_slug_unique" ON "webinars" USING btree ("slug");
