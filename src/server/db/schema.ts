import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
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
    referredByCode: text("referred_by_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    index("user_role_idx").on(table.role),
    index("user_created_at_idx").on(table.createdAt),
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

export const userProfile = pgTable(
  "user_profile",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    birthDate: timestamp("birth_date", { withTimezone: true }),
    birthYear: integer("birth_year"),
    phoneNumber: text("phone_number"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    country: text("country"),
    governorate: text("governorate"),
    city: text("city"),
    preferredLocale: text("preferred_locale").notNull().default("fr"),
    requestedPersona: text("requested_persona"),
    educationLevel: text("education_level"),
    institutionName: text("institution_name"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("user_profile_user_unique").on(table.userId),
    index("user_profile_phone_idx").on(table.phoneNumber),
    check("user_profile_locale_check", sql`${table.preferredLocale} in ('fr','ar')`),
    check(
      "user_profile_requested_persona_check",
      sql`${table.requestedPersona} is null or ${table.requestedPersona} in ('STUDENT','AVS','PARENT','TEACHER','SPECIALIST','ORGANIZATION')`,
    ),
    check(
      "user_profile_birth_year_bounds_check",
      sql`${table.birthYear} is null or (${table.birthYear} >= 1900 and ${table.birthYear} <= 2100)`,
    ),
  ],
);

export const authSessionAssurance = pgTable(
  "auth_session_assurance",
  {
    id: text("id").primaryKey().$defaultFn(id),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("auth_session_assurance_session_unique").on(table.sessionId),
    index("auth_session_assurance_user_idx").on(table.userId),
    index("auth_session_assurance_expires_idx").on(table.expiresAt),
    check("auth_session_assurance_method_check", sql`${table.method} in ('EMAIL','WHATSAPP')`),
  ],
);

export const authVerificationChallenge = pgTable(
  "auth_verification_challenge",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    channel: text("channel").notNull(),
    destination: text("destination").notNull(),
    destinationMasked: text("destination_masked").notNull(),
    codeHash: text("code_hash").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    resendAvailableAt: timestamp("resend_available_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    deliveryVersion: integer("delivery_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("auth_verification_challenge_user_idx").on(table.userId, table.status, table.createdAt),
    index("auth_verification_challenge_session_idx").on(table.sessionId, table.purpose, table.status),
    index("auth_verification_challenge_destination_idx").on(table.destination, table.createdAt),
    check(
      "auth_verification_challenge_purpose_check",
      sql`${table.purpose} in ('LOGIN','PASSWORD_RESET','ACCOUNT_RECOVERY','VERIFY_EMAIL','VERIFY_PHONE','CHANGE_EMAIL','CHANGE_PHONE','SENSITIVE_ACTION')`,
    ),
    check("auth_verification_challenge_channel_check", sql`${table.channel} in ('EMAIL','WHATSAPP')`),
    check(
      "auth_verification_challenge_status_check",
      sql`${table.status} in ('ACTIVE','VERIFIED','LOCKED','SUPERSEDED','EXPIRED','CANCELLED')`,
    ),
    check("auth_verification_challenge_attempt_nonnegative", sql`${table.attemptCount} >= 0`),
    check("auth_verification_challenge_max_attempt_positive", sql`${table.maxAttempts} > 0`),
    check("auth_verification_challenge_delivery_version_positive", sql`${table.deliveryVersion} > 0`),
  ],
);

export const authResetAuthorization = pgTable(
  "auth_reset_authorization",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => authVerificationChallenge.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("auth_reset_authorization_token_hash_unique").on(table.tokenHash),
    uniqueIndex("auth_reset_authorization_active_user_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'ACTIVE'`),
    check("auth_reset_authorization_status_check", sql`${table.status} in ('ACTIVE','CONSUMED','EXPIRED','REVOKED')`),
  ],
);

export const authEvent = pgTable(
  "auth_event",
  {
    id: text("id").primaryKey().$defaultFn(id),
    requestId: text("request_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    provider: text("provider"),
    channel: text("channel"),
    purpose: text("purpose"),
    eventType: text("event_type").notNull(),
    safeReasonCode: text("safe_reason_code"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("auth_event_created_idx").on(table.createdAt),
    index("auth_event_user_created_idx").on(table.userId, table.createdAt),
    check("auth_event_channel_check", sql`${table.channel} is null or ${table.channel} in ('EMAIL','WHATSAPP')`),
    check(
      "auth_event_purpose_check",
      sql`${table.purpose} is null or ${table.purpose} in ('LOGIN','PASSWORD_RESET','ACCOUNT_RECOVERY','VERIFY_EMAIL','VERIFY_PHONE','CHANGE_EMAIL','CHANGE_PHONE','SENSITIVE_ACTION')`,
    ),
  ],
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
    // Phase 8: media provider abstraction. 'internal' (default) preserves the
    // existing videoUrl/signedMediaUrl() path unchanged. 'youtube' is for
    // public/preview lessons (embed by canonical video id, no signing).
    // 'cloudflare_stream' is for protected paid video (mediaRef is the Stream
    // video UID; a short-lived playback token is requested server-side only
    // after the same enrollment/entitlement check getLearningCourse() uses).
    mediaProvider: text("media_provider").notNull().default("internal"),
    mediaRef: text("media_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("lessons_course_position_unique").on(table.courseId, table.position),
    index("lessons_course_idx").on(table.courseId),
    index("lessons_module_idx").on(table.moduleId),
    check("lessons_position_positive", sql`${table.position} > 0`),
    check("lessons_duration_nonnegative", sql`${table.durationSeconds} >= 0`),
    check("lessons_media_provider_check", sql`${table.mediaProvider} in ('internal','youtube','cloudflare_stream')`),
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
    // Phase 7: descriptive metadata only, never a second entitlement path —
    // every existing entitlement check (hasEntitlement, getLearningCourse)
    // continues to check only for the presence of an enrollments row, not
    // its source. See docs/premium/ROADMAP.md Phase 7, DATA_MODEL.md §8.
    source: text("source").notNull().default("PAYMENT"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().$defaultFn(now),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("enrollment_user_course_unique").on(table.userId, table.courseId),
    index("enrollment_user_idx").on(table.userId),
    index("enrollment_course_idx").on(table.courseId),
    index("enrollment_status_idx").on(table.status),
    check("enrollment_progress_range", sql`${table.progressPercent} between 0 and 100`),
    check("enrollment_status_check", sql`${table.status} in ('active','completed','cancelled')`),
    check(
      "enrollment_source_check",
      sql`${table.source} in ('PAYMENT','TEST_PASS','ORGANIZATION','ADMIN','MANUAL')`,
    ),
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

export const videoCheckpoint = pgTable(
  "video_checkpoint",
  {
    id: text("id").primaryKey().$defaultFn(id),
    lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    // triggerSeconds >= the lesson's durationSeconds marks a post-video (formative) question
    // rather than an in-stream pause point.
    triggerSeconds: integer("trigger_seconds").notNull(),
    kind: text("kind").notNull().default("REFLECTION"),
    promptFr: text("prompt_fr").notNull(),
    promptAr: text("prompt_ar").notNull(),
    options: jsonb("options").$type<{ id: string; textFr: string; textAr: string }[]>(),
    correctOptionId: text("correct_option_id"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("video_checkpoint_lesson_idx").on(table.lessonId, table.triggerSeconds),
    check("video_checkpoint_kind_check", sql`${table.kind} in ('REFLECTION','QUIZ')`),
    check("video_checkpoint_trigger_check", sql`${table.triggerSeconds} >= 0`),
  ],
);

export const videoCheckpointResponse = pgTable(
  "video_checkpoint_response",
  {
    id: text("id").primaryKey().$defaultFn(id),
    enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    checkpointId: text("checkpoint_id").notNull().references(() => videoCheckpoint.id, { onDelete: "cascade" }),
    responseText: text("response_text"),
    selectedOptionId: text("selected_option_id"),
    correct: boolean("correct"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("video_checkpoint_response_unique").on(table.enrollmentId, table.checkpointId),
  ],
);

export const courseDiscussionPosts = pgTable(
  "course_discussion_posts",
  {
    id: text("id").primaryKey().$defaultFn(id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    foreignKey({ columns: [table.parentId], foreignColumns: [table.id] }).onDelete("cascade"),
    index("course_discussion_course_created_idx").on(table.courseId, table.createdAt),
    index("course_discussion_parent_idx").on(table.parentId),
    index("course_discussion_author_idx").on(table.authorUserId, table.createdAt),
    check("course_discussion_body_length_check", sql`char_length(btrim(${table.body})) between 2 and 2000`),
  ],
);

// LMS assessments are intentionally separate from the organization-scoped
// `assessment` table below, which represents a CRM/admission evaluation.
export const learningAssessment = pgTable(
  "learning_assessment",
  {
    id: text("id").primaryKey().$defaultFn(id),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    moduleId: text("module_id").references(() => courseModules.id, { onDelete: "cascade" }),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    instructionsFr: text("instructions_fr").notNull().default(""),
    instructionsAr: text("instructions_ar").notNull().default(""),
    timeLimitSeconds: integer("time_limit_seconds").notNull().default(900),
    passingScore: integer("passing_score").notNull().default(70),
    maxAttempts: integer("max_attempts").notNull().default(3),
    published: boolean("published").notNull().default(false),
    revealAnswersAfterPass: boolean("reveal_answers_after_pass").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("learning_assessment_course_idx").on(table.courseId, table.published),
    index("learning_assessment_module_idx").on(table.moduleId),
    check("learning_assessment_time_limit_check", sql`${table.timeLimitSeconds} between 60 and 14400`),
    check("learning_assessment_passing_score_check", sql`${table.passingScore} between 0 and 100`),
    check("learning_assessment_max_attempts_check", sql`${table.maxAttempts} between 1 and 10`),
  ],
);

export const learningQuestion = pgTable(
  "learning_question",
  {
    id: text("id").primaryKey().$defaultFn(id),
    assessmentId: text("assessment_id").notNull().references(() => learningAssessment.id, { onDelete: "cascade" }),
    promptFr: text("prompt_fr").notNull(),
    promptAr: text("prompt_ar").notNull(),
    type: text("type").notNull(),
    position: integer("position").notNull(),
    points: integer("points").notNull(),
    explanationFr: text("explanation_fr"),
    explanationAr: text("explanation_ar"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("learning_question_assessment_position_unique").on(table.assessmentId, table.position),
    index("learning_question_assessment_idx").on(table.assessmentId),
    check("learning_question_type_check", sql`${table.type} in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE')`),
    check("learning_question_position_check", sql`${table.position} between 1 and 1000`),
    check("learning_question_points_check", sql`${table.points} between 1 and 100`),
  ],
);

export const learningQuestionOption = pgTable(
  "learning_question_option",
  {
    id: text("id").primaryKey().$defaultFn(id),
    questionId: text("question_id").notNull().references(() => learningQuestion.id, { onDelete: "cascade" }),
    textFr: text("text_fr").notNull(),
    textAr: text("text_ar").notNull(),
    position: integer("position").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (table) => [
    uniqueIndex("learning_question_option_position_unique").on(table.questionId, table.position),
    index("learning_question_option_question_idx").on(table.questionId),
    check("learning_question_option_position_check", sql`${table.position} between 1 and 20`),
  ],
);

export const learningAttempt = pgTable(
  "learning_attempt",
  {
    id: text("id").primaryKey().$defaultFn(id),
    assessmentId: text("assessment_id").notNull().references(() => learningAssessment.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().$defaultFn(now),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    rawPoints: integer("raw_points"),
    maxPoints: integer("max_points"),
    percentage: integer("percentage"),
    passed: boolean("passed"),
  },
  (table) => [
    uniqueIndex("learning_attempt_user_number_unique").on(table.assessmentId, table.userId, table.attemptNumber),
    uniqueIndex("learning_attempt_one_active_unique").on(table.assessmentId, table.userId).where(sql`${table.status} = 'IN_PROGRESS'`),
    index("learning_attempt_assessment_submitted_idx").on(table.assessmentId, table.submittedAt),
    index("learning_attempt_user_idx").on(table.userId, table.startedAt),
    check("learning_attempt_number_check", sql`${table.attemptNumber} between 1 and 10`),
    check("learning_attempt_status_check", sql`${table.status} in ('IN_PROGRESS','SUBMITTED','EXPIRED','GRADED')`),
    check("learning_attempt_points_check", sql`${table.rawPoints} is null or ${table.rawPoints} >= 0`),
    check("learning_attempt_max_points_check", sql`${table.maxPoints} is null or ${table.maxPoints} > 0`),
    check("learning_attempt_percentage_check", sql`${table.percentage} is null or ${table.percentage} between 0 and 100`),
  ],
);

export const learningAnswer = pgTable(
  "learning_answer",
  {
    id: text("id").primaryKey().$defaultFn(id),
    attemptId: text("attempt_id").notNull().references(() => learningAttempt.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull().references(() => learningQuestion.id, { onDelete: "cascade" }),
    selectedOptionIds: jsonb("selected_option_ids").$type<string[]>().notNull(),
    pointsAwarded: integer("points_awarded").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("learning_answer_attempt_question_unique").on(table.attemptId, table.questionId),
    index("learning_answer_attempt_idx").on(table.attemptId),
    check("learning_answer_points_check", sql`${table.pointsAwarded} >= 0`),
  ],
);

// Gamification: virtual points economy (no real currency, no payment
// integration). Balance is always SUM(delta) over this ledger — never a
// separately stored counter — to avoid drift between a cached balance and
// the transactions that produced it. The partial unique index on
// (userId, reason, referenceId) is what makes grantPoints() idempotent: a
// retried/duplicate call for the same lesson/course/attempt/etc. is a safe
// no-op rather than a double award.
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("points_ledger_user_idx").on(table.userId, table.createdAt),
    uniqueIndex("points_ledger_idempotency_unique").on(table.userId, table.reason, table.referenceId).where(sql`${table.referenceId} is not null`),
    check("points_ledger_reason_check", sql`${table.reason} in ('LESSON_COMPLETE','COURSE_COMPLETE','QUIZ_PASSED','REFERRAL_BONUS','REWARD_REDEMPTION','ADMIN_ADJUSTMENT')`),
  ],
);

export const rewardItem = pgTable(
  "reward_item",
  {
    id: text("id").primaryKey().$defaultFn(id),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionFr: text("description_fr").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    costPoints: integer("cost_points").notNull(),
    stock: integer("stock"),
    coverImage: text("cover_image"),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    check("reward_item_cost_positive", sql`${table.costPoints} > 0`),
    check("reward_item_stock_nonnegative", sql`${table.stock} is null or ${table.stock} >= 0`),
  ],
);

export const rewardRedemption = pgTable(
  "reward_redemption",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    rewardItemId: text("reward_item_id").notNull().references(() => rewardItem.id, { onDelete: "cascade" }),
    costPoints: integer("cost_points").notNull(),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (table) => [
    index("reward_redemption_user_idx").on(table.userId, table.createdAt),
    check("reward_redemption_status_check", sql`${table.status} in ('PENDING','FULFILLED','CANCELLED')`),
  ],
);

// One referral code per user (lazily created on first visit to the referral
// page). referralConversion.referredUserId is unique: a given account can be
// the "referred" party of at most one referral, ever.
export const referralCode = pgTable(
  "referral_code",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("referral_code_user_unique").on(table.userId),
    uniqueIndex("referral_code_code_unique").on(table.code),
  ],
);

export const referralConversion = pgTable(
  "referral_conversion",
  {
    id: text("id").primaryKey().$defaultFn(id),
    referralCodeId: text("referral_code_id").notNull().references(() => referralCode.id, { onDelete: "cascade" }),
    referredUserId: text("referred_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("referral_conversion_referred_user_unique").on(table.referredUserId),
    index("referral_conversion_code_idx").on(table.referralCodeId),
    check("referral_conversion_status_check", sql`${table.status} in ('PENDING','REWARDED')`),
  ],
);

// Automated content-publish notifications (news/webinar/course). One row per
// publish event; the outbox BROADCAST_EMAIL_SEND handler resolves the
// audience itself at send time rather than trusting a snapshot here.
export const broadcastNotification = pgTable(
  "broadcast_notification",
  {
    id: text("id").primaryKey().$defaultFn(id),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    ctaUrl: text("cta_url").notNull(),
    createdBy: text("created_by").notNull().references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    status: text("status").notNull().default("PENDING"),
    recipientCount: integer("recipient_count"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    check("broadcast_notification_kind_check", sql`${table.kind} in ('NEWS','WEBINAR','COURSE')`),
    check("broadcast_notification_status_check", sql`${table.status} in ('PENDING','SENT','FAILED')`),
  ],
);

// Phase 7: minimal organization-scoped cohort. A cohort belongs to one
// organization (nullable — ANEI-direct courses may run cohort-free) and one
// course. Cohort membership references an enrollment rather than
// duplicating student/course truth: `cohortMembership.enrollmentId` is the
// single source of "who is in this cohort," and the partial UNIQUE below
// guarantees at most one cohort per enrollment. See docs/premium/
// DATA_MODEL.md §4, ROADMAP.md Phase 7.
export const cohort = pgTable(
  "cohort",
  {
    id: text("id").primaryKey().$defaultFn(id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("DRAFT"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    capacity: integer("capacity"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("cohort_org_course_idx").on(table.organizationId, table.courseId),
    index("cohort_course_idx").on(table.courseId),
    check("cohort_status_check", sql`${table.status} in ('DRAFT','ACTIVE','CLOSED','ARCHIVED')`),
    check("cohort_capacity_positive", sql`${table.capacity} is null or ${table.capacity} > 0`),
  ],
);

export const cohortMembership = pgTable(
  "cohort_membership",
  {
    id: text("id").primaryKey().$defaultFn(id),
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohort.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("cohort_membership_cohort_enrollment_unique").on(table.cohortId, table.enrollmentId),
    // One cohort per enrollment — prevents a single enrollment being
    // double-counted in two cohorts' rosters/capacity.
    uniqueIndex("cohort_membership_enrollment_unique").on(table.enrollmentId),
    index("cohort_membership_cohort_idx").on(table.cohortId),
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
    level: text("level").notNull().default("beginner"),
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
    check("resources_level_check", sql`${table.level} in ('beginner','intermediate','advanced')`),
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
    index("payments_status_created_idx").on(table.status, table.createdAt),
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

// Teacher <-> course assignment. Same shape/semantics as
// avsStudentAssignment/specialistStudentAssignment: admin/org-manager-only,
// history-preserving (ON DELETE restrict), at most one ACTIVE assignment per
// teacher/course pair. A TEACHER persona alone grants no course access; only
// an ACTIVE row here does, and it grants a teaching-view scope limited to
// this one course — never platform course-edit rights and never every
// course. See docs/premium/ROADMAP.md Phase 7 §K/§L.
export const teacherCourseAssignment = pgTable(
  "teacher_course_assignment",
  {
    id: text("id").primaryKey().$defaultFn(id),
    teacherUserId: text("teacher_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    status: text("status").notNull().default("ACTIVE"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("teacher_course_assignment_active_unique")
      .on(table.teacherUserId, table.courseId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("teacher_course_assignment_teacher_idx").on(table.teacherUserId, table.status),
    index("teacher_course_assignment_course_idx").on(table.courseId),
    check("teacher_course_assignment_status_check", sql`${table.status} in ('ACTIVE','ENDED')`),
  ],
);

// -----------------------------------------------------------------------------
// Persona-specific profile tables (professional personas only). `user_profile`
// stays common identity/contact/location data shared by every persona a user
// holds; these tables hold the data that only makes sense for one persona.
// Each is owned by a `persona_membership` row (not directly by `user_id`) so a
// single account holding both TEACHER and SPECIALIST personas gets two
// independent rows that can never collide or overwrite each other — the FK +
// UNIQUE(persona_membership_id) pair guarantees at most one profile row per
// membership, and the owning service (src/server/services/persona-profiles.ts)
// additionally verifies persona_membership.persona matches the expected
// persona before every write (a bare FK cannot express that constraint).
// ON DELETE cascade mirrors persona_membership's own cascade from `user` -
// deleting the membership (or the user) removes the persona-specific data
// with it, same lifecycle as the membership it belongs to.
export const teacherProfile = pgTable(
  "teacher_profile",
  {
    id: text("id").primaryKey().$defaultFn(id),
    personaMembershipId: text("persona_membership_id")
      .notNull()
      .references(() => personaMembership.id, { onDelete: "cascade" }),
    discipline: text("discipline"),
    qualification: text("qualification"),
    experienceYears: integer("experience_years"),
    levelsTaught: text("levels_taught").array(),
    professionalInstitution: text("professional_institution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("teacher_profile_membership_unique").on(table.personaMembershipId),
    check(
      "teacher_profile_experience_years_check",
      sql`${table.experienceYears} is null or (${table.experienceYears} >= 0 and ${table.experienceYears} <= 80)`,
    ),
  ],
);

export const avsProfile = pgTable(
  "avs_profile",
  {
    id: text("id").primaryKey().$defaultFn(id),
    personaMembershipId: text("persona_membership_id")
      .notNull()
      .references(() => personaMembership.id, { onDelete: "cascade" }),
    qualification: text("qualification"),
    experienceYears: integer("experience_years"),
    interventionDomains: text("intervention_domains").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("avs_profile_membership_unique").on(table.personaMembershipId),
    check(
      "avs_profile_experience_years_check",
      sql`${table.experienceYears} is null or (${table.experienceYears} >= 0 and ${table.experienceYears} <= 80)`,
    ),
  ],
);

export const specialistProfile = pgTable(
  "specialist_profile",
  {
    id: text("id").primaryKey().$defaultFn(id),
    personaMembershipId: text("persona_membership_id")
      .notNull()
      .references(() => personaMembership.id, { onDelete: "cascade" }),
    specialty: text("specialty"),
    qualification: text("qualification"),
    experienceYears: integer("experience_years"),
    practiceStructure: text("practice_structure"),
    interventionDomains: text("intervention_domains").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("specialist_profile_membership_unique").on(table.personaMembershipId),
    check(
      "specialist_profile_experience_years_check",
      sql`${table.experienceYears} is null or (${table.experienceYears} >= 0 and ${table.experienceYears} <= 80)`,
    ),
  ],
);

// Pre-approval ORGANIZATION-persona application data only - deliberately NOT
// the authoritative `organization`/`organization_membership` entities below.
// Holding the ORGANIZATION persona never grants organization access by
// itself; that always requires an explicit, separately-created
// organization_membership row (see src/server/services/organizations.ts).
export const organizationProfile = pgTable(
  "organization_profile",
  {
    id: text("id").primaryKey().$defaultFn(id),
    personaMembershipId: text("persona_membership_id")
      .notNull()
      .references(() => personaMembership.id, { onDelete: "cascade" }),
    organizationName: text("organization_name"),
    organizationType: text("organization_type"),
    representativeRole: text("representative_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("organization_profile_membership_unique").on(table.personaMembershipId)],
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
    // (id, organizationId) unique enables the composite FK that keeps Phase 4
    // appointment/assessment/admission contact references organization-scoped
    // (a row in org A can never point at a contact in org B at the DB level).
    uniqueIndex("crm_contact_id_org_unique").on(table.id, table.organizationId),
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
      sql`${table.type} in ('CONTACT_CREATED','CONTACT_UPDATED','CONTACT_ARCHIVED','CONTACT_RESTORED','USER_LINKED','USER_UNLINKED','ASSIGNEE_CHANGED','TAG_ATTACHED','TAG_DETACHED','NOTE_ADDED','STAGE_CHANGED','APPOINTMENT_CREATED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','APPOINTMENT_COMPLETED','ASSESSMENT_CREATED','ASSESSMENT_COMPLETED','ADMISSION_ACCEPTED','ADMISSION_REJECTED','WHATSAPP_TEMPLATE_SENT','WHATSAPP_MESSAGE_RECEIVED','WHATSAPP_FAILED','ACCOUNT_INVITATION_SENT','PHONE_VERIFIED','ACCOUNT_LINKED','ACCOUNT_INVITATION_REVOKED','COURSE_ENROLLED','WHATSAPP_AI_REPLY_SENT','CONTACT_AUTO_PROVISIONED')`,
    ),
  ],
);

export const appointment = pgTable(
  "appointment",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    assignedToUserId: text("assigned_to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    type: text("type").notNull().default("ASSESSMENT"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("SCHEDULED"),
    note: text("note"),
    meetingUrl: text("meeting_url"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    // Composite FK keeps the appointment's contact within the same organization
    // (a row in org A can never reference a contact in org B at the DB level).
    foreignKey({
      name: "appointment_contact_org_fk",
      columns: [table.contactId, table.organizationId],
      foreignColumns: [crmContact.id, crmContact.organizationId],
    }),
    // (id, organizationId) unique enables the composite assessment FK below.
    uniqueIndex("appointment_id_org_unique").on(table.id, table.organizationId),
    index("appointment_org_start_idx").on(table.organizationId, table.startAt),
    index("appointment_assignee_start_idx").on(table.assignedToUserId, table.startAt),
    index("appointment_contact_idx").on(table.contactId),
    check("appointment_status_check", sql`${table.status} in ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')`),
    check("appointment_type_check", sql`${table.type} in ('ASSESSMENT','INFO_MEETING','FOLLOW_UP','OTHER')`),
    check("appointment_time_range_check", sql`${table.endAt} > ${table.startAt}`),
  ],
);

export const appointmentAvailabilityRule = pgTable(
  "appointment_availability_rule",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    assignedToUserId: text("assigned_to_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    // Exactly one of weekday (recurring template) / specificDate (one-off slot) is set — see appointment_availability_recurrence_check.
    weekday: integer("weekday"),
    specificDate: date("specific_date"),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    type: text("type").notNull().default("FOLLOW_UP"),
    sessionType: text("session_type").notNull().default("INDIVIDUAL"),
    capacity: integer("capacity").notNull().default(1),
    timezone: text("timezone").notNull().default("Africa/Tunis"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("appointment_availability_rule_weekly_unique").on(table.organizationId, table.assignedToUserId, table.weekday, table.startMinute).where(sql`${table.weekday} is not null`),
    uniqueIndex("appointment_availability_rule_dated_unique").on(table.organizationId, table.assignedToUserId, table.specificDate, table.startMinute).where(sql`${table.specificDate} is not null`),
    index("appointment_availability_rule_org_active_idx").on(table.organizationId, table.active),
    check("appointment_availability_recurrence_check", sql`(${table.weekday} is not null) <> (${table.specificDate} is not null)`),
    check("appointment_availability_weekday_check", sql`${table.weekday} is null or ${table.weekday} between 0 and 6`),
    check("appointment_availability_minutes_check", sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.endMinute} > ${table.startMinute}`),
    check("appointment_availability_duration_check", sql`${table.durationMinutes} between 15 and 240`),
    check("appointment_availability_type_check", sql`${table.type} in ('ASSESSMENT','INFO_MEETING','FOLLOW_UP','OTHER')`),
    check("appointment_availability_session_type_check", sql`${table.sessionType} in ('INDIVIDUAL','GROUP')`),
    check("appointment_availability_capacity_check", sql`${table.capacity} between 1 and 200`),
    check("appointment_availability_timezone_check", sql`${table.timezone} = 'Africa/Tunis'`),
  ],
);

export const appointmentEvent = pgTable(
  "appointment_event",
  {
    id: text("id").primaryKey().$defaultFn(id),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointment.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    previousStartAt: timestamp("previous_start_at", { withTimezone: true }),
    newStartAt: timestamp("new_start_at", { withTimezone: true }),
    previousEndAt: timestamp("previous_end_at", { withTimezone: true }),
    newEndAt: timestamp("new_end_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("appointment_event_appointment_idx").on(table.appointmentId, table.createdAt),
    check(
      "appointment_event_type_check",
      sql`${table.eventType} in ('CREATED','RESCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')`,
    ),
  ],
);

export const assessment = pgTable(
  "assessment",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    appointmentId: text("appointment_id"),
    assessorUserId: text("assessor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("DRAFT"),
    score: integer("score"),
    maxScore: integer("max_score"),
    summary: text("summary"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    foreignKey({
      name: "assessment_contact_org_fk",
      columns: [table.contactId, table.organizationId],
      foreignColumns: [crmContact.id, crmContact.organizationId],
    }),
    foreignKey({
      name: "assessment_appointment_org_fk",
      columns: [table.appointmentId, table.organizationId],
      foreignColumns: [appointment.id, appointment.organizationId],
    }),
    // (id, organizationId) unique enables the composite admission FK below.
    uniqueIndex("assessment_id_org_unique").on(table.id, table.organizationId),
    index("assessment_org_contact_idx").on(table.organizationId, table.contactId),
    index("assessment_appointment_idx").on(table.appointmentId),
    check("assessment_status_check", sql`${table.status} in ('DRAFT','COMPLETED')`),
  ],
);

export const admission = pgTable(
  "admission",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    assessmentId: text("assessment_id"),
    decision: text("decision").notNull().default("PENDING"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    foreignKey({
      name: "admission_contact_org_fk",
      columns: [table.contactId, table.organizationId],
      foreignColumns: [crmContact.id, crmContact.organizationId],
    }),
    foreignKey({
      name: "admission_assessment_org_fk",
      columns: [table.assessmentId, table.organizationId],
      foreignColumns: [assessment.id, assessment.organizationId],
    }),
    // (id, organizationId) unique enables the Phase 6 composite invitation FK below.
    uniqueIndex("admission_id_org_unique").on(table.id, table.organizationId),
    index("admission_org_decision_idx").on(table.organizationId, table.decision),
    index("admission_contact_idx").on(table.contactId),
    check("admission_decision_check", sql`${table.decision} in ('PENDING','ACCEPTED','REJECTED')`),
  ],
);

// -----------------------------------------------------------------------------
// Phase 5: WhatsApp Cloud API foundation. WhatsApp is a COMMUNICATION CHANNEL —
// never the CRM contact itself, never an ANEI account, never authentication,
// authorization, admission or enrollment. Records associate primarily with CRM
// contacts and organization scope; `linkedUserId` is never required. A single
// deployment-level Meta credential (env-only, never stored here) serves every
// organization; `whatsappAccount` maps a configured Meta phone number to an
// organization. Message rows are business communication history: they are never
// cascade-deleted when a contact is archived or an admission/linked user
// changes (contact_id uses ON DELETE SET NULL so history survives contact
// removal). See docs/premium/ROADMAP.md Phase 5.
// -----------------------------------------------------------------------------

export const whatsappAccount = pgTable(
  "whatsapp_account",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("meta"),
    phoneNumberId: text("phone_number_id").notNull(),
    businessAccountId: text("business_account_id").notNull(),
    displayPhoneNumber: text("display_phone_number"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    // A given Meta phone number belongs to exactly one deployment, so a single
    // global unique is safe and prevents two organizations from ever claiming
    // the same provider number.
    uniqueIndex("whatsapp_account_phone_number_unique").on(table.phoneNumberId),
    index("whatsapp_account_org_idx").on(table.organizationId),
    check("whatsapp_account_provider_check", sql`${table.provider} in ('meta')`),
    check("whatsapp_account_status_check", sql`${table.status} in ('ACTIVE','DISABLED')`),
  ],
);

export const whatsappTemplate = pgTable(
  "whatsapp_template",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    language: text("language").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("PENDING"),
    parameterCount: integer("parameter_count").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("whatsapp_template_org_name_language_unique").on(table.organizationId, table.name, table.language),
    index("whatsapp_template_org_idx").on(table.organizationId),
    check(
      "whatsapp_template_status_check",
      sql`${table.status} in ('PENDING','APPROVED','REJECTED','PAUSED','DISABLED')`,
    ),
    check("whatsapp_template_parameter_count_nonnegative", sql`${table.parameterCount} >= 0`),
  ],
);

export const whatsappMessage = pgTable(
  "whatsapp_message",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => whatsappAccount.id, { onDelete: "set null" }),
    // Nullable until an inbound message can be deterministically resolved to a
    // CRM contact — an unresolved inbound message is stored, never dropped.
    contactId: text("contact_id").references(() => crmContact.id, { onDelete: "set null" }),
    direction: text("direction").notNull(),
    messageType: text("message_type").notNull(),
    status: text("status").notNull().default("QUEUED"),
    providerMessageId: text("provider_message_id"),
    localRequestId: text("local_request_id"),
    fromPhone: text("from_phone"),
    toPhone: text("to_phone"),
    templateName: text("template_name"),
    templateLanguage: text("template_language"),
    textPreview: text("text_preview"),
    providerErrorCode: text("provider_error_code"),
    providerErrorMessage: text("provider_error_message"),
    // Phase 9: template body parameters, needed by the worker at send time
    // (moved out of the request path). Non-secret parameters (e.g. an
    // invitation URL) are stored in the clear in `bodyParameters`. Secret
    // parameters (the OTP digit string) are NEVER stored here in plaintext —
    // they go through `bodyParametersEncrypted` (AES-256-GCM ciphertext, see
    // src/server/security/outbox-crypto.ts) and are scrubbed back to null
    // once the worker has attempted delivery (success or terminal failure).
    // At most one of the two is populated for a given message.
    bodyParameters: jsonb("body_parameters").$type<string[]>(),
    bodyParametersEncrypted: jsonb("body_parameters_encrypted").$type<{ ciphertext: string; nonce: string }>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("whatsapp_message_provider_id_unique")
      .on(table.providerMessageId)
      .where(sql`${table.providerMessageId} is not null`),
    uniqueIndex("whatsapp_message_local_request_unique")
      .on(table.organizationId, table.localRequestId)
      .where(sql`${table.localRequestId} is not null`),
    index("whatsapp_message_org_created_idx").on(table.organizationId, table.createdAt),
    index("whatsapp_message_contact_created_idx").on(table.contactId, table.createdAt),
    index("whatsapp_message_account_idx").on(table.accountId),
    index("whatsapp_message_direction_status_idx").on(table.direction, table.status),
    check("whatsapp_message_direction_check", sql`${table.direction} in ('INBOUND','OUTBOUND')`),
    check("whatsapp_message_type_check", sql`${table.messageType} in ('TEMPLATE','TEXT')`),
    check(
      "whatsapp_message_status_check",
      sql`${table.status} in ('QUEUED','SENT','DELIVERED','READ','FAILED')`,
    ),
  ],
);

export const whatsappWebhookEvent = pgTable(
  "whatsapp_webhook_event",
  {
    id: text("id").primaryKey().$defaultFn(id),
    // Stable, provider-derived idempotency key (e.g. `message:<wamid>` /
    // `status:<wamid>:<status>`). Unique so a Meta retry/replay of the same
    // event is a no-op at the DB level.
    stableKey: text("stable_key").notNull(),
    eventType: text("event_type").notNull(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().$defaultFn(now),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("whatsapp_webhook_event_stable_key_unique").on(table.stableKey),
    index("whatsapp_webhook_event_org_received_idx").on(table.organizationId, table.receivedAt),
    check(
      "whatsapp_webhook_event_type_check",
      sql`${table.eventType} in ('INBOUND_MESSAGE','STATUS_UPDATE')`,
    ),
  ],
);

export type WhatsappAccountRow = typeof whatsappAccount.$inferSelect;
export type WhatsappTemplateRow = typeof whatsappTemplate.$inferSelect;
export type WhatsappMessageRow = typeof whatsappMessage.$inferSelect;
export type WhatsappWebhookEventRow = typeof whatsappWebhookEvent.$inferSelect;

// -----------------------------------------------------------------------------
// Phase 9: transactional outbox. A business-mutation transaction inserts an
// outbox_event row in the SAME transaction as the domain change it represents
// (see src/server/queue/outbox.ts's enqueueOutboxEvent) so "mutation
// committed but the intent to notify an external system was lost" cannot
// happen locally. A separate worker process (scripts/worker.ts) claims rows
// with `SELECT ... FOR UPDATE SKIP LOCKED`, releases the DB lock immediately,
// then performs the external call outside any transaction. This guarantees
// durable LOCAL intent and at-least-once WORKER execution — it does NOT by
// itself guarantee exactly-once PROVIDER delivery (see
// docs/premium/PHASE9_HANDOFF.md for the residual ambiguous-outcome window).
// `eventType` is an allowlisted, versioned-payload registry
// (src/server/queue/event-types.ts) — never an arbitrary stored handler name.
// -----------------------------------------------------------------------------

export const outboxEvent = pgTable(
  "outbox_event",
  {
    id: text("id").primaryKey().$defaultFn(id),
    // Nullable: not every event is organization-scoped (kept loose/non-FK,
    // matching aggregateType/aggregateId, since this table intentionally
    // references rows across many aggregate tables).
    organizationId: text("organization_id"),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadVersion: integer("payload_version").notNull().default(1),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().$defaultFn(now),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("outbox_event_idempotency_key_unique").on(table.idempotencyKey),
    // Worker claim query: PENDING rows ready to run, oldest first.
    index("outbox_event_claim_idx").on(table.status, table.availableAt),
    // Stale-lease recovery scan.
    index("outbox_event_processing_idx").on(table.status, table.lockedAt),
    index("outbox_event_org_created_idx").on(table.organizationId, table.createdAt),
    check("outbox_event_status_check", sql`${table.status} in ('PENDING','PROCESSING','SUCCEEDED','FAILED')`),
    check("outbox_event_event_type_check", sql`${table.eventType} in ('WHATSAPP_TEMPLATE_SEND','AUTOMATION_TRIGGER','WHATSAPP_AI_REPLY','BROADCAST_EMAIL_SEND')`),
    check("outbox_event_attempts_nonnegative", sql`${table.attempts} >= 0`),
    check("outbox_event_max_attempts_positive", sql`${table.maxAttempts} > 0`),
    check("outbox_event_payload_version_positive", sql`${table.payloadVersion} > 0`),
  ],
);

export type OutboxEventRow = typeof outboxEvent.$inferSelect;

// -----------------------------------------------------------------------------
// Phase 6: account invitation + phone verification + CRM contact -> ANEI user
// linking. An invitation is a durable, revocable, one-time-consumable
// credential — never an account, never a session, never authentication by
// itself. Phone verification (OTP) proves control of the invited phone at
// that moment; it never authenticates a Better Auth user, never selects an
// existing account by phone, and the actual account provisioning/login
// remains entirely owned by Better Auth (see docs/premium/SECURITY_MODEL.md
// and docs/premium/ROADMAP.md Phase 6). `admission_id_org_unique` below
// mirrors the same composite-FK pattern Phase 3/4 already established for
// crm_contact/appointment/assessment, so an invitation can never reference an
// admission from a foreign organization at the DB level.
// -----------------------------------------------------------------------------

export const accountInvitation = pgTable(
  "account_invitation",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull(),
    admissionId: text("admission_id").notNull(),
    intendedPersona: text("intended_persona").notNull().default("STUDENT"),
    status: text("status").notNull().default("PENDING_SEND"),
    // Snapshot of the normalized destination phone at invitation-creation
    // time. A later CRM phone edit never silently redirects an existing
    // invitation's OTP destination — see docs/premium/ROADMAP.md Phase 6 §D.
    destinationPhone: text("destination_phone").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenVersion: integer("token_version").notNull().default(1),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    foreignKey({
      name: "account_invitation_contact_org_fk",
      columns: [table.contactId, table.organizationId],
      foreignColumns: [crmContact.id, crmContact.organizationId],
    }),
    foreignKey({
      name: "account_invitation_admission_org_fk",
      columns: [table.admissionId, table.organizationId],
      foreignColumns: [admission.id, admission.organizationId],
    }),
    uniqueIndex("account_invitation_token_hash_unique").on(table.tokenHash),
    // At most one non-terminal (PENDING_SEND/SENT/VERIFIED) invitation per
    // contact at a time — resend rotates the existing row's token instead of
    // creating a new one; a REVOKED/EXPIRED/CONSUMED row never blocks a
    // fresh invitation later.
    uniqueIndex("account_invitation_contact_active_unique")
      .on(table.contactId)
      .where(sql`${table.status} in ('PENDING_SEND','SENT','VERIFIED')`),
    index("account_invitation_org_created_idx").on(table.organizationId, table.createdAt),
    index("account_invitation_contact_status_idx").on(table.contactId, table.status),
    index("account_invitation_admission_idx").on(table.admissionId),
    check(
      "account_invitation_status_check",
      sql`${table.status} in ('PENDING_SEND','SENT','SEND_FAILED','VERIFIED','CONSUMED','REVOKED','EXPIRED')`,
    ),
    check("account_invitation_persona_check", sql`${table.intendedPersona} in ('STUDENT')`),
  ],
);

export const accountVerificationChallenge = pgTable(
  "account_verification_challenge",
  {
    id: text("id").primaryKey().$defaultFn(id),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => accountInvitation.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    // At most one ACTIVE challenge per invitation — DB-authoritative, not
    // relied on purely in application memory.
    uniqueIndex("account_verification_challenge_active_unique")
      .on(table.invitationId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("account_verification_challenge_invitation_idx").on(table.invitationId, table.status),
    check(
      "account_verification_challenge_status_check",
      sql`${table.status} in ('ACTIVE','VERIFIED','LOCKED','SUPERSEDED','EXPIRED')`,
    ),
    check("account_verification_challenge_attempt_nonnegative", sql`${table.attemptCount} >= 0`),
    check("account_verification_challenge_max_attempts_positive", sql`${table.maxAttempts} > 0`),
  ],
);

export const accountInvitationEvent = pgTable(
  "account_invitation_event",
  {
    id: text("id").primaryKey().$defaultFn(id),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => accountInvitation.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("account_invitation_event_invitation_idx").on(table.invitationId, table.createdAt),
    check(
      "account_invitation_event_type_check",
      sql`${table.eventType} in ('INVITATION_CREATED','INVITATION_SENT','INVITATION_RESENT','INVITATION_SEND_FAILED','OTP_SENT','PHONE_VERIFIED','INVITATION_REVOKED','INVITATION_CONSUMED')`,
    ),
  ],
);

export type AccountInvitationRow = typeof accountInvitation.$inferSelect;
export type AccountVerificationChallengeRow = typeof accountVerificationChallenge.$inferSelect;
export type AccountInvitationEventRow = typeof accountInvitationEvent.$inferSelect;

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

// -----------------------------------------------------------------------------
// Phase 10A/10B: AI Core + RAG + Controlled Tool Registry
// -----------------------------------------------------------------------------

export const knowledgeDocument = pgTable(
  "knowledge_document",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    title: text("title").notNull(),
    visibility: text("visibility").notNull().default("PRIVATE"),
    contentHash: text("content_hash").notNull(),
    status: text("status").notNull().default("PENDING"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("knowledge_document_org_idx").on(table.organizationId),
    index("knowledge_document_source_idx").on(table.sourceType, table.sourceId),
    index("knowledge_document_visibility_idx").on(table.visibility),
    check("knowledge_document_visibility_check", sql`${table.visibility} in ('PUBLIC','PLATFORM','ORGANIZATION','PRIVATE')`),
    check("knowledge_document_status_check", sql`${table.status} in ('PENDING','INDEXED','FAILED','ARCHIVED')`),
  ],
);

export const knowledgeChunk = pgTable(
  "knowledge_chunk",
  {
    id: text("id").primaryKey().$defaultFn(id),
    documentId: text("document_id")
      .notNull()
      .references(() => knowledgeDocument.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("knowledge_chunk_document_idx").on(table.documentId, table.chunkIndex),
    index("knowledge_chunk_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ],
);

export const aiConversation = pgTable(
  "ai_conversation",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    title: text("title"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("ai_conversation_user_idx").on(table.userId, table.createdAt),
    index("ai_conversation_org_idx").on(table.organizationId, table.createdAt),
    check("ai_conversation_status_check", sql`${table.status} in ('ACTIVE','ARCHIVED')`),
  ],
);

export const aiMessage = pgTable(
  "ai_message",
  {
    id: text("id").primaryKey().$defaultFn(id),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [
    index("ai_message_conversation_idx").on(table.conversationId, table.createdAt),
    check("ai_message_role_check", sql`${table.role} in ('USER','ASSISTANT','TOOL','SYSTEM')`),
  ],
);

export const aiToolExecution = pgTable(
  "ai_tool_execution",
  {
    id: text("id").primaryKey().$defaultFn(id),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    riskLevel: text("risk_level").notNull(),
    inputHash: text("input_hash").notNull(),
    safeInputPreview: jsonb("safe_input_preview"),
    status: text("status").notNull().default("PROPOSED"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().$defaultFn(now),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    resultCode: text("result_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("ai_tool_execution_conversation_idx").on(table.conversationId, table.requestedAt),
    index("ai_tool_execution_user_status_idx").on(table.userId, table.status),
    check("ai_tool_execution_risk_check", sql`${table.riskLevel} in ('READ','LOW_RISK_WRITE','BUSINESS_WRITE','SENSITIVE')`),
    check("ai_tool_execution_status_check", sql`${table.status} in ('PROPOSED','CONFIRMED','EXECUTED','REJECTED','FAILED','EXPIRED')`),
  ],
);

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    durationMs: integer("duration_ms").notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
  },
  (table) => [index("ai_usage_log_user_idx").on(table.userId, table.createdAt)],
);

// -----------------------------------------------------------------------------
// Phase 10C/10D/10E: automation + MCP foundation.
//
// automation_service_credential: machine/service identities for trusted
// first-party automation (n8n). Only a strong keyed hash of the raw token is
// ever stored; the raw token is returned exactly once at creation and lives
// in n8n's encrypted credential store. Scopes are a bounded capability list;
// an endpoint's organization/entity checks always remain the final gate.
// See docs/premium/PHASE10_AUTOMATION_MCP_HANDOFF.md.
// -----------------------------------------------------------------------------
export const automationServiceCredential = pgTable(
  "automation_service_credential",
  {
    id: text("id").primaryKey().$defaultFn(id),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    organizationId: text("organization_id"),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    status: text("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(now),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("automation_service_credential_token_hash_unique").on(table.tokenHash),
    index("automation_service_credential_org_idx").on(table.organizationId, table.status),
    check("automation_service_credential_status_check", sql`${table.status} in ('ACTIVE','REVOKED')`),
  ],
);

export type AutomationServiceCredentialRow = typeof automationServiceCredential.$inferSelect;

/**
 * automation_execution: business-level automation executions. Distinct from
 * outbox_event — the outbox is delivery/retry infrastructure; this table
 * records the logical automation request (allowlisted workflow name,
 * idempotency key, status). The AUTOMATION_TRIGGER outbox payload carries only
 * { automationExecutionId }; every other fact is reloaded authoritatively.
 */
export const automationExecution = pgTable(
  "automation_execution",
  {
    id: text("id").primaryKey().$defaultFn(id),
    organizationId: text("organization_id"),
    workflowName: text("workflow_name").notNull(),
    workflowVersion: integer("workflow_version").notNull().default(1),
    status: text("status").notNull().default("PENDING"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
    referenceId: text("reference_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().$defaultFn(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$defaultFn(now),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    externalExecutionId: text("external_execution_id"),
    resultCode: text("result_code"),
    safeError: text("safe_error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    claimedBy: text("claimed_by"),
  },
  (table) => [
    uniqueIndex("automation_execution_idempotency_key_unique").on(table.idempotencyKey),
    index("automation_execution_org_created_idx").on(table.organizationId, table.requestedAt),
    index("automation_execution_status_idx").on(table.status),
    check(
      "automation_execution_status_check",
      sql`${table.status} in ('PENDING','DISPATCHED','RUNNING','SUCCEEDED','FAILED','FAILED_TO_DISPATCH','WORKFLOW_FAILED')`,
    ),
    check("automation_execution_attempt_nonnegative", sql`${table.attemptCount} >= 0`),
    check("automation_execution_workflow_version_positive", sql`${table.workflowVersion} > 0`),
  ],
);

export type AutomationExecutionRow = typeof automationExecution.$inferSelect;

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
  (table) => [
    index("audit_actor_idx").on(table.actorUserId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export type DbUser = typeof user.$inferSelect;
export type PersonaMembershipRow = typeof personaMembership.$inferSelect;
export type OrganizationRow = typeof organization.$inferSelect;
export type OrganizationMembershipRow = typeof organizationMembership.$inferSelect;
export type ParentStudentLinkRow = typeof parentStudentLink.$inferSelect;
export type AvsStudentAssignmentRow = typeof avsStudentAssignment.$inferSelect;
export type SpecialistStudentAssignmentRow = typeof specialistStudentAssignment.$inferSelect;
export type TeacherCourseAssignmentRow = typeof teacherCourseAssignment.$inferSelect;
export type CohortRow = typeof cohort.$inferSelect;
export type CohortMembershipRow = typeof cohortMembership.$inferSelect;
export type CrmPipelineRow = typeof crmPipeline.$inferSelect;
export type CrmPipelineStageRow = typeof crmPipelineStage.$inferSelect;
export type CrmContactRow = typeof crmContact.$inferSelect;
export type CrmTagRow = typeof crmTag.$inferSelect;
export type CrmContactNoteRow = typeof crmContactNote.$inferSelect;
export type CrmContactActivityRow = typeof crmContactActivity.$inferSelect;
export type AppointmentRow = typeof appointment.$inferSelect;
export type AppointmentEventRow = typeof appointmentEvent.$inferSelect;
export type AssessmentRow = typeof assessment.$inferSelect;
export type AdmissionRow = typeof admission.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type LearningAssessmentRow = typeof learningAssessment.$inferSelect;
export type LearningQuestionRow = typeof learningQuestion.$inferSelect;
export type LearningQuestionOptionRow = typeof learningQuestionOption.$inferSelect;
export type LearningAttemptRow = typeof learningAttempt.$inferSelect;
export type LearningAnswerRow = typeof learningAnswer.$inferSelect;
export type CourseDiscussionPostRow = typeof courseDiscussionPosts.$inferSelect;
export type ResourceRow = typeof resources.$inferSelect;
export type WebinarRow = typeof webinars.$inferSelect;
export type NewsPostRow = typeof newsPosts.$inferSelect;
export type KnowledgeDocumentRow = typeof knowledgeDocument.$inferSelect;
export type KnowledgeChunkRow = typeof knowledgeChunk.$inferSelect;
export type AiConversationRow = typeof aiConversation.$inferSelect;
export type AiMessageRow = typeof aiMessage.$inferSelect;
export type AiToolExecutionRow = typeof aiToolExecution.$inferSelect;
export type AiUsageLogRow = typeof aiUsageLog.$inferSelect;
export type PointsLedgerRow = typeof pointsLedger.$inferSelect;
export type RewardItemRow = typeof rewardItem.$inferSelect;
export type RewardRedemptionRow = typeof rewardRedemption.$inferSelect;
export type ReferralCodeRow = typeof referralCode.$inferSelect;
export type ReferralConversionRow = typeof referralConversion.$inferSelect;
export type BroadcastNotificationRow = typeof broadcastNotification.$inferSelect;
