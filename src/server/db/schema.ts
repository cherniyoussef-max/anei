import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const now = () => new Date();
const id = () => crypto.randomUUID();

// -----------------------------------------------------------------------------
// Better Auth core tables + ANEI-safe user fields.
// Field names intentionally match Better Auth's public schema contract.
// -----------------------------------------------------------------------------
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("USER"),
    locale: text("locale").notNull().default("fr"),
    profileType: text("profile_type").notNull().default("learner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    index("user_role_idx").on(table.role),
    check("user_role_check", sql`${table.role} in ('USER','ADMIN','SUPER_ADMIN')`),
    check("user_locale_check", sql`${table.locale} in ('fr','ar')`),
    check("user_profile_type_check", sql`${table.profileType} in ('learner','teacher','avs','parent','specialist','institution')`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey().$defaultFn(id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_idx").on(table.userId),
    index("session_expires_idx").on(table.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey().$defaultFn(id),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_unique").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey().$defaultFn(id),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable(
  "rateLimit",
  {
    id: text("id").primaryKey().$defaultFn(id),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("rate_limit_key_unique").on(table.key)],
);

// -----------------------------------------------------------------------------
// Domain tables.
// Monetary values are stored as millimes to avoid floating-point errors.
// -----------------------------------------------------------------------------
export const courses = pgTable(
  "courses",
  {
    id: text("id").primaryKey().$defaultFn(id),
    slug: text("slug").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    summaryFr: text("summary_fr").notNull(),
    summaryAr: text("summary_ar").notNull(),
    descriptionFr: text("description_fr").notNull(),
    descriptionAr: text("description_ar").notNull(),
    category: text("category").notNull(),
    level: text("level").notNull().default("beginner"),
    mode: text("mode").notNull().default("online"),
    trainerName: text("trainer_name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceMillimes: integer("price_millimes").notNull().default(0),
    startAt: timestamp("start_at", { withTimezone: true }),
    coverImage: text("cover_image"),
    published: boolean("published").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    objectives: jsonb("objectives").$type<{ fr: string[]; ar: string[] }>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("courses_slug_unique").on(table.slug),
    index("courses_category_idx").on(table.category),
    index("courses_published_idx").on(table.published),
    index("courses_published_created_idx").on(table.published, table.createdAt),
    index("courses_published_price_idx").on(table.published, table.priceMillimes),
    check("courses_duration_positive", sql`${table.durationMinutes} > 0`),
    check("courses_price_nonnegative", sql`${table.priceMillimes} >= 0`),
    check("courses_level_check", sql`${table.level} in ('beginner','intermediate','advanced')`),
    check("courses_mode_check", sql`${table.mode} in ('online','hybrid','onsite')`),
  ],
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: text("id").primaryKey().$defaultFn(id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionFr: text("description_fr").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("course_modules_course_position_unique").on(table.courseId, table.position),
    index("course_modules_course_idx").on(table.courseId),
    check("course_modules_position_positive", sql`${table.position} > 0`),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: text("id").primaryKey().$defaultFn(id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleId: text("module_id").references(() => courseModules.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionFr: text("description_fr").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    videoUrl: text("video_url"),
    documentUrl: text("document_url"),
    preview: boolean("preview").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("lessons_course_position_unique").on(table.courseId, table.position),
    index("lessons_course_idx").on(table.courseId),
    index("lessons_module_idx").on(table.moduleId),
    check("lessons_position_positive", sql`${table.position} > 0`),
    check("lessons_duration_nonnegative", sql`${table.durationSeconds} >= 0`),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    progressPercent: integer("progress_percent").notNull().default(0),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().$defaultFn(now),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("enrollment_user_course_unique").on(table.userId, table.courseId),
    index("enrollment_user_idx").on(table.userId),
    check("enrollment_progress_range", sql`${table.progressPercent} between 0 and 100`),
    check("enrollment_status_check", sql`${table.status} in ('active','completed','cancelled')`),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: text("id").primaryKey().$defaultFn(id),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("lesson_progress_unique").on(table.enrollmentId, table.lessonId),
    check("lesson_progress_watched_nonnegative", sql`${table.watchedSeconds} >= 0`),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey().$defaultFn(id),
    slug: text("slug").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionFr: text("description_fr").notNull(),
    descriptionAr: text("description_ar").notNull(),
    audienceFr: text("audience_fr").notNull(),
    audienceAr: text("audience_ar").notNull(),
    type: text("type").notNull(),
    priceMillimes: integer("price_millimes").notNull(),
    coverImage: text("cover_image"),
    downloadUrl: text("download_url"),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("resources_slug_unique").on(table.slug),
    index("resources_published_created_idx").on(table.published, table.createdAt),
    index("resources_published_type_idx").on(table.published, table.type),
    check("resources_price_nonnegative", sql`${table.priceMillimes} >= 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    itemType: text("item_type").notNull(),
    itemId: text("item_id").notNull(),
    itemLabel: text("item_label").notNull(),
    amountMillimes: integer("amount_millimes").notNull(),
    currency: text("currency").notNull().default("TND"),
    status: text("status").notNull().default("pending"),
    provider: text("provider").notNull().default("mock"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("orders_user_idempotency_unique").on(table.userId, table.idempotencyKey),
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_status_created_idx").on(table.status, table.createdAt),
    index("orders_user_created_idx").on(table.userId, table.createdAt),
    check("orders_amount_nonnegative", sql`${table.amountMillimes} >= 0`),
    check("orders_currency_check", sql`${table.currency} in ('TND')`),
    check("orders_status_check", sql`${table.status} in ('pending','paid','failed','expired','cancelled')`),
    check("orders_provider_check", sql`${table.provider} in ('mock','flouci','clicktopay','free')`),
    check("orders_item_type_check", sql`${table.itemType} in ('course','resource')`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalPaymentId: text("external_payment_id"),
    status: text("status").notNull().default("pending"),
    amountMillimes: integer("amount_millimes").notNull(),
    checkoutUrl: text("checkout_url"),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("payments_order_idx").on(table.orderId),
    uniqueIndex("payments_provider_external_unique").on(table.provider, table.externalPaymentId),
    check("payments_amount_nonnegative", sql`${table.amountMillimes} >= 0`),
    check("payments_status_check", sql`${table.status} in ('pending','paid','failed','expired','cancelled')`),
    check("payments_provider_check", sql`${table.provider} in ('mock','flouci','clicktopay')`),
  ],
);

export const purchases = pgTable(
  "purchases",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("purchases_order_unique").on(table.orderId),
    uniqueIndex("purchases_user_resource_unique").on(table.userId, table.resourceId),
    index("purchases_user_idx").on(table.userId),
  ],
);

export const webinars = pgTable(
  "webinars",
  {
    id: text("id").primaryKey().$defaultFn(id),
    slug: text("slug").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionFr: text("description_fr").notNull(),
    descriptionAr: text("description_ar").notNull(),
    trainerName: text("trainer_name").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    meetingUrl: text("meeting_url"),
    replayUrl: text("replay_url"),
    published: boolean("published").notNull().default(true),
  },
  (table) => [
    uniqueIndex("webinars_slug_unique").on(table.slug),
    index("webinars_published_starts_idx").on(table.published, table.startsAt),
    check("webinars_duration_positive", sql`${table.durationMinutes} > 0`),
  ],
);

export const webinarRegistrations = pgTable(
  "webinar_registrations",
  {
    id: text("id").primaryKey().$defaultFn(id),
    webinarId: text("webinar_id")
      .notNull()
      .references(() => webinars.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("webinar_registration_unique").on(table.webinarId, table.userId)],
);

export const avsProfiles = pgTable(
  "avs_profiles",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    cityFr: text("city_fr").notNull(),
    cityAr: text("city_ar").notNull(),
    specialtyFr: text("specialty_fr").notNull(),
    specialtyAr: text("specialty_ar").notNull(),
    availabilityFr: text("availability_fr").notNull(),
    availabilityAr: text("availability_ar").notNull(),
    bioFr: text("bio_fr").notNull().default(""),
    bioAr: text("bio_ar").notNull().default(""),
    certified: boolean("certified").notNull().default(false),
    visible: boolean("visible").notNull().default(true),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("avs_city_idx").on(table.cityFr),
    index("avs_certified_idx").on(table.certified),
    index("avs_visible_certified_idx").on(table.visible, table.certified),
  ],
);

// Persona membership: a user's product-facing role(s) (TEACHER/AVS/PARENT/
// SPECIALIST/ORGANIZATION/STUDENT), separate from the Better Auth security
// role (`user.role`). Multiple personas per user are supported; exactly one
// is primary (drives default portal routing). `user.profileType` remains the
// legacy single-value source (kept for backward compatibility) and is
// backfilled 1:1 into this table; this table is authoritative going forward.
export const personaMembership = pgTable(
  "persona_membership",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    persona: text("persona").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("persona_membership_user_persona_unique").on(table.userId, table.persona),
    uniqueIndex("persona_membership_user_primary_unique")
      .on(table.userId)
      .where(sql`${table.isPrimary} = true`),
    index("persona_membership_user_idx").on(table.userId),
    index("persona_membership_persona_idx").on(table.persona),
    index("persona_membership_status_idx").on(table.status),
    check(
      "persona_membership_persona_check",
      sql`${table.persona} in ('TEACHER','AVS','PARENT','SPECIALIST','ORGANIZATION','STUDENT')`,
    ),
    check(
      "persona_membership_status_check",
      sql`${table.status} in ('PENDING_REVIEW','ACTIVE','SUSPENDED','REJECTED')`,
    ),
  ],
);

// Phase 2: multi-tenant organizations. Kept minimal — no billing/branding/
// subscription fields, per docs/premium/ROADMAP.md Phase 2 scope.
export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey().$defaultFn(id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("organization_slug_unique").on(table.slug),
    check("organization_status_check", sql`${table.status} in ('ACTIVE','SUSPENDED')`),
  ],
);

// Organization membership: a user's role within an organization
// (OWNER/MANAGER/STAFF/VIEWER), distinct from both the platform security
// role (`user.role`) and product-facing personas. Authorization is always
// DB-authoritative — never trust a client-supplied role. A partial unique
// index (below) prevents duplicate *active* memberships for the same
// user/organization pair while still allowing a REVOKED row to be
// superseded by a new ACTIVE one.
export const organizationMembership = pgTable(
  "organization_membership",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("organization_membership_active_unique")
      .on(table.organizationId, table.userId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("organization_membership_org_idx").on(table.organizationId),
    index("organization_membership_user_idx").on(table.userId),
    check("organization_membership_role_check", sql`${table.role} in ('OWNER','MANAGER','STAFF','VIEWER')`),
    check("organization_membership_status_check", sql`${table.status} in ('ACTIVE','REVOKED')`),
  ],
);

// Parent <-> student relationship. Admin-managed only in Phase 2 (no
// self-invitation/OTP/WhatsApp flow yet) — see docs/premium/SECURITY_MODEL.md
// §2: a subject can never create their own relationship row. A PARENT
// persona alone grants no data access; only an ACTIVE row here does.
// parentUserId/studentUserId use ON DELETE restrict (not cascade), matching
// createdBy: this row is relationship history, never destructively removed
// as a side effect of deleting either party's account.
export const parentStudentLink = pgTable(
  "parent_student_link",
  {
    id: text("id").primaryKey().$defaultFn(id),
    parentUserId: text("parent_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    relationshipType: text("relationship_type").notNull(),
    status: text("status").notNull().default("PENDING"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("parent_student_link_unique").on(table.parentUserId, table.studentUserId),
    index("parent_student_link_parent_idx").on(table.parentUserId),
    index("parent_student_link_student_idx").on(table.studentUserId),
    check("parent_student_link_self_check", sql`${table.parentUserId} != ${table.studentUserId}`),
    check(
      "parent_student_link_relationship_type_check",
      sql`${table.relationshipType} in ('MOTHER','FATHER','GUARDIAN','OTHER')`,
    ),
    check("parent_student_link_status_check", sql`${table.status} in ('PENDING','ACTIVE','REVOKED')`),
  ],
);

// AVS <-> student assignment. Deliberately a separate table from
// `avsProfiles` (the existing public directory/profile model) — see
// docs/premium/ROADMAP.md Phase 2 §E. Supports assignment history: a
// student can have multiple historical (ENDED) assignments, but the
// partial unique index below allows at most one ACTIVE assignment per
// avs/student pair at a time. An AVS persona alone grants no data access;
// only an ACTIVE row here does. avsUserId/studentUserId use ON DELETE
// restrict, matching createdBy, so history is never destructively removed
// as a side effect of deleting either party's account.
export const avsStudentAssignment = pgTable(
  "avs_student_assignment",
  {
    id: text("id").primaryKey().$defaultFn(id),
    avsUserId: text("avs_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("ACTIVE"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().$defaultFn(now),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("avs_student_assignment_active_unique")
      .on(table.avsUserId, table.studentUserId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("avs_student_assignment_avs_idx").on(table.avsUserId, table.status),
    index("avs_student_assignment_student_idx").on(table.studentUserId),
    check("avs_student_assignment_self_check", sql`${table.avsUserId} != ${table.studentUserId}`),
    check("avs_student_assignment_status_check", sql`${table.status} in ('ACTIVE','ENDED')`),
  ],
);

// Specialist <-> student assignment. Same shape/semantics as
// avsStudentAssignment (kept as a separate table since AVS and SPECIALIST
// are distinct personas with independent assignment histories).
export const specialistStudentAssignment = pgTable(
  "specialist_student_assignment",
  {
    id: text("id").primaryKey().$defaultFn(id),
    specialistUserId: text("specialist_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("ACTIVE"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().$defaultFn(now),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("specialist_student_assignment_active_unique")
      .on(table.specialistUserId, table.studentUserId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("specialist_student_assignment_specialist_idx").on(table.specialistUserId, table.status),
    index("specialist_student_assignment_student_idx").on(table.studentUserId),
    check("specialist_student_assignment_self_check", sql`${table.specialistUserId} != ${table.studentUserId}`),
    check("specialist_student_assignment_status_check", sql`${table.status} in ('ACTIVE','ENDED')`),
  ],
);

// -----------------------------------------------------------------------------
// Phase 3: CRM foundation. Deliberately namespaced `crm*`/`crm_*` and kept
// separate from `contactMessages` (the public website contact-form
// submissions table) and from `/admin/contacts` — a CRM contact is a
// lead/person the organization is tracking, not a website form submission.
// See docs/premium/ROADMAP.md Phase 3 and docs/premium/DATA_MODEL.md §5.
//
// A CRM contact is explicitly NOT a user account: `linkedUserId` is always
// optional, no credentials/session fields exist here, and no account is ever
// created as a side effect of CRM mutations (see SECURITY_MODEL.md-style
// reasoning: authorization for CRM data comes from organization membership,
// never from the CRM contact record itself).
// -----------------------------------------------------------------------------

export const crmPipeline = pgTable(
  "crm_pipeline",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("crm_pipeline_org_name_unique").on(table.organizationId, table.name),
    index("crm_pipeline_org_idx").on(table.organizationId),
  ],
);

// `organizationId` is denormalized from the parent pipeline so that
// `crmContact.currentStageId` can carry a composite FK
// (currentStageId, organizationId) -> (id, organizationId) — this makes a
// contact referencing a stage from a foreign organization/pipeline a DB-level
// impossibility, not just an application-level check.
export const crmPipelineStage = pgTable(
  "crm_pipeline_stage",
  {
    id: text("id").primaryKey().$defaultFn(id),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => crmPipeline.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("crm_pipeline_stage_id_org_unique").on(table.id, table.organizationId),
    uniqueIndex("crm_pipeline_stage_pipeline_position_unique").on(table.pipelineId, table.position),
    index("crm_pipeline_stage_pipeline_idx").on(table.pipelineId),
  ],
);

export const crmContact = pgTable(
  "crm_contact",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    linkedUserId: text("linked_user_id").references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    status: text("status").notNull().default("ACTIVE"),
    currentStageId: text("current_stage_id"),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "crm_contact_stage_org_fk",
      columns: [table.currentStageId, table.organizationId],
      foreignColumns: [crmPipelineStage.id, crmPipelineStage.organizationId],
    }),
    index("crm_contact_org_idx").on(table.organizationId, table.status),
    index("crm_contact_stage_idx").on(table.currentStageId),
    index("crm_contact_assignee_idx").on(table.assignedToUserId),
    // A user may be linked from at most one CRM contact per organization —
    // prevents nonsensical duplicate links (docs/premium/ROADMAP.md Phase 3 §D).
    uniqueIndex("crm_contact_org_linked_user_unique")
      .on(table.organizationId, table.linkedUserId)
      .where(sql`${table.linkedUserId} is not null`),
    index("crm_contact_created_idx").on(table.organizationId, table.createdAt),
    check("crm_contact_status_check", sql`${table.status} in ('ACTIVE','ARCHIVED')`),
  ],
);

export const crmTag = pgTable(
  "crm_tag",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("crm_tag_org_name_unique").on(table.organizationId, table.name),
    index("crm_tag_org_idx").on(table.organizationId),
  ],
);

export const crmContactTag = pgTable(
  "crm_contact_tag",
  {
    contactId: text("contact_id")
      .notNull()
      .references(() => crmContact.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => crmTag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.tagId] }),
    index("crm_contact_tag_tag_idx").on(table.tagId),
  ],
);

export const crmContactNote = pgTable(
  "crm_contact_note",
  {
    id: text("id").primaryKey().$defaultFn(id),
    contactId: text("contact_id")
      .notNull()
      .references(() => crmContact.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [index("crm_contact_note_contact_idx").on(table.contactId, table.createdAt)],
);

export const crmContactActivity = pgTable(
  "crm_contact_activity",
  {
    id: text("id").primaryKey().$defaultFn(id),
    contactId: text("contact_id")
      .notNull()
      .references(() => crmContact.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("crm_contact_activity_contact_idx").on(table.contactId, table.createdAt),
    check(
      "crm_contact_activity_type_check",
      sql`${table.type} in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED')`,
    ),
  ],
);

export const certificates = pgTable(
  "certificates",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    fileUrl: text("file_url"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("certificate_code_unique").on(table.code),
    uniqueIndex("certificate_user_course_unique").on(table.userId, table.courseId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [index("notifications_user_read_idx").on(table.userId, table.read)],
);

export const newsPosts = pgTable(
  "news_posts",
  {
    id: text("id").primaryKey().$defaultFn(id),
    slug: text("slug").notNull(),
    tagFr: text("tag_fr").notNull(),
    tagAr: text("tag_ar").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    excerptFr: text("excerpt_fr").notNull(),
    excerptAr: text("excerpt_ar").notNull(),
    contentFr: text("content_fr").notNull(),
    contentAr: text("content_ar").notNull(),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("news_posts_slug_unique").on(table.slug),
    index("news_posts_published_idx").on(table.published, table.publishedAt),
  ],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: text("id").primaryKey().$defaultFn(id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("contact_status_idx").on(table.status),
    check("contact_status_check", sql`${table.status} in ('new','read','closed')`),
  ],
);

export const newsletterSubscriptions = pgTable(
  "newsletter_subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(id),
    email: text("email").notNull(),
    locale: text("locale").notNull().default("fr"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("newsletter_email_unique").on(table.email)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(id),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [index("audit_actor_idx").on(table.actorUserId)],
);

export type DbUser = typeof user.$inferSelect;
export type PersonaMembershipRow = typeof personaMembership.$inferSelect;
export type OrganizationRow = typeof organization.$inferSelect;
export type OrganizationMembershipRow = typeof organizationMembership.$inferSelect;
export type ParentStudentLinkRow = typeof parentStudentLink.$inferSelect;
export type AvsStudentAssignmentRow = typeof avsStudentAssignment.$inferSelect;
export type SpecialistStudentAssignmentRow = typeof specialistStudentAssignment.$inferSelect;
export type CrmPipelineRow = typeof crmPipeline.$inferSelect;
export type CrmPipelineStageRow = typeof crmPipelineStage.$inferSelect;
export type CrmContactRow = typeof crmContact.$inferSelect;
export type CrmTagRow = typeof crmTag.$inferSelect;
export type CrmContactNoteRow = typeof crmContactNote.$inferSelect;
export type CrmContactActivityRow = typeof crmContactActivity.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type ResourceRow = typeof resources.$inferSelect;
export type WebinarRow = typeof webinars.$inferSelect;
export type NewsPostRow = typeof newsPosts.$inferSelect;
