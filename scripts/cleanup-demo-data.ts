import "dotenv/config";
import { eq, inArray, like, or } from "drizzle-orm";
import { Pool } from "pg";
import { getDatabaseUrl } from "./migration-env";
import {
  accountInvitation,
  admission,
  appointment,
  assessment,
  avsStudentAssignment,
  broadcastNotification,
  cohort,
  courses,
  crmContact,
  crmContactNote,
  orders,
  parentStudentLink,
  purchases,
  resources,
  specialistStudentAssignment,
  teacherCourseAssignment,
  user,
} from "../src/server/db/schema";
import { drizzle } from "drizzle-orm/node-postgres";

// Mirrors scripts/seed.ts and scripts/reset-db.ts: this script only ever
// touches a local, disposable database. It exists because ad-hoc raw SQL
// against a live database (attempted once in an earlier session against the
// anei-postgres container, and correctly blocked) is not how this repo
// deletes data — this goes through Drizzle's schema/FK definitions instead,
// defaults to a dry run, and requires an explicit flag to actually delete.
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run cleanup-demo-data against NODE_ENV=production.");
}

const databaseUrl = getDatabaseUrl();
const parsedUrl = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)) {
  throw new Error("Refusing to run cleanup-demo-data because DATABASE_URL is not local.");
}

const args = new Set(process.argv.slice(2));
const confirm = args.has("--confirm");
const includeSeedFixtures = args.has("--include-seed-fixtures");

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

// Patterns observed in this database (verified 2026-08-21): automated
// integration/security-audit test runs create users, courses, and
// resources directly against this dev database instead of an isolated
// test database, and never clean up after themselves. These patterns
// match only that synthetic data — not real accounts/content.
const TEST_EMAIL_CONDITIONS = [
  like(user.email, "%@example.test"),
  like(user.email, "%@test.com"),
  like(user.email, "tool-test-%"),
];
const TEST_COURSE_SLUG_PREFIXES = ["stream-course-", "learn-course-", "public-course-", "enrolled-course-", "preview-course-", "target-course-"];
const SEED_FIXTURE_EMAILS = ["admin@anei.local", "learner@anei.local"];

async function main() {
  const testUsers = await db.select({ id: user.id, email: user.email }).from(user).where(or(...TEST_EMAIL_CONDITIONS));
  const testCourses = await db
    .select({ id: courses.id, slug: courses.slug })
    .from(courses)
    .where(or(eq(courses.category, "test"), ...TEST_COURSE_SLUG_PREFIXES.map((prefix) => like(courses.slug, `${prefix}%`))));
  const testResources = await db.select({ id: resources.id, slug: resources.slug }).from(resources).where(like(resources.slug, "storage-authz-resource-%"));

  let seedUsers: { id: string; email: string }[] = [];
  if (includeSeedFixtures) {
    seedUsers = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.email, SEED_FIXTURE_EMAILS));
  }

  const allTargetUserIds = [...testUsers, ...seedUsers].map((u) => u.id);
  const allTargetCourseIds = testCourses.map((c) => c.id);
  const allTargetResourceIds = testResources.map((r) => r.id);

  console.log(`Test-pattern users:     ${testUsers.length} (@example.test / @test.com / tool-test-*)`);
  if (includeSeedFixtures) console.log(`Seed fixture users:     ${seedUsers.length} (${SEED_FIXTURE_EMAILS.join(", ")})`);
  console.log(`Test-pattern courses:   ${testCourses.length} (category='test' or synthetic slug prefix)`);
  console.log(`Test-pattern resources: ${testResources.length} (slug 'storage-authz-resource-*')`);

  if (!confirm) {
    console.log("\nDry run only — no rows deleted. Re-run with --confirm to delete the rows counted above.");
    console.log("Add --include-seed-fixtures to also remove the two scripts/seed.ts demo accounts (admin@anei.local, learner@anei.local) and nothing else additionally — their demo courses/resources are not seed-fixture-flagged and won't be swept by this script unless they also match the test patterns above.");
    await pool.end();
    return;
  }

  if (!allTargetUserIds.length && !allTargetCourseIds.length && !allTargetResourceIds.length) {
    console.log("\nNothing matched. Nothing to delete.");
    await pool.end();
    return;
  }

  await pool.query("BEGIN");
  try {
    if (allTargetUserIds.length) {
      // crm_contact is referenced by appointment/assessment/admission/
      // account_invitation via composite (contact_id, organization_id) FKs
      // that are independent of any user-id column — a crm_contact row
      // created by a target user can still be blocked from deletion by one
      // of these even after every user-id-scoped row is cleared. Resolve
      // the contact ids up front so both the user-id path and the
      // contact-id path are covered.
      const targetContacts = await db.select({ id: crmContact.id }).from(crmContact).where(inArray(crmContact.createdByUserId, allTargetUserIds));
      const targetContactIds = targetContacts.map((c) => c.id);

      // RESTRICT/NO ACTION dependents must be cleared before their parents,
      // in this order — mirrors the dependency chain Postgres enforces
      // (children before parents): account_invitation depends on admission
      // and crm_contact; admission depends on assessment and crm_contact;
      // assessment depends on appointment and crm_contact; appointment
      // depends on crm_contact. crm_contact itself is deleted last, right
      // before the user rows.
      await db.delete(purchases).where(inArray(purchases.orderId, db.select({ id: orders.id }).from(orders).where(inArray(orders.userId, allTargetUserIds))));
      await db.delete(orders).where(inArray(orders.userId, allTargetUserIds));
      await db.delete(accountInvitation).where(
        or(
          targetContactIds.length ? inArray(accountInvitation.contactId, targetContactIds) : undefined,
          inArray(accountInvitation.createdByUserId, allTargetUserIds),
        ),
      );
      if (targetContactIds.length) await db.delete(admission).where(inArray(admission.contactId, targetContactIds));
      await db.delete(assessment).where(
        or(
          targetContactIds.length ? inArray(assessment.contactId, targetContactIds) : undefined,
          inArray(assessment.assessorUserId, allTargetUserIds),
        ),
      );
      await db.delete(appointment).where(
        or(
          targetContactIds.length ? inArray(appointment.contactId, targetContactIds) : undefined,
          inArray(appointment.assignedToUserId, allTargetUserIds),
          inArray(appointment.createdByUserId, allTargetUserIds),
        ),
      );
      await db
        .delete(avsStudentAssignment)
        .where(
          or(
            inArray(avsStudentAssignment.createdBy, allTargetUserIds),
            inArray(avsStudentAssignment.avsUserId, allTargetUserIds),
            inArray(avsStudentAssignment.studentUserId, allTargetUserIds),
          ),
        );
      await db.delete(cohort).where(inArray(cohort.createdByUserId, allTargetUserIds));
      await db.delete(crmContactNote).where(inArray(crmContactNote.authorUserId, allTargetUserIds));
      await db.delete(crmContact).where(inArray(crmContact.createdByUserId, allTargetUserIds));
      await db
        .delete(parentStudentLink)
        .where(
          or(
            inArray(parentStudentLink.createdBy, allTargetUserIds),
            inArray(parentStudentLink.parentUserId, allTargetUserIds),
            inArray(parentStudentLink.studentUserId, allTargetUserIds),
          ),
        );
      await db.delete(specialistStudentAssignment).where(
        or(
          inArray(specialistStudentAssignment.createdBy, allTargetUserIds),
          inArray(specialistStudentAssignment.specialistUserId, allTargetUserIds),
          inArray(specialistStudentAssignment.studentUserId, allTargetUserIds),
        ),
      );
      await db.delete(teacherCourseAssignment).where(
        or(inArray(teacherCourseAssignment.teacherUserId, allTargetUserIds), inArray(teacherCourseAssignment.createdBy, allTargetUserIds)),
      );
      await db.delete(broadcastNotification).where(inArray(broadcastNotification.createdBy, allTargetUserIds));

      const deletedUsers = await db.delete(user).where(inArray(user.id, allTargetUserIds)).returning({ id: user.id });
      console.log(`Deleted ${deletedUsers.length} users (and their cascading rows: sessions, enrollments, certificates, notifications, etc.).`);
    }

    if (allTargetCourseIds.length) {
      await db.delete(teacherCourseAssignment).where(inArray(teacherCourseAssignment.courseId, allTargetCourseIds));
      const deletedCourses = await db.delete(courses).where(inArray(courses.id, allTargetCourseIds)).returning({ id: courses.id });
      console.log(`Deleted ${deletedCourses.length} courses (and their cascading modules/lessons/enrollments/etc.).`);
    }

    if (allTargetResourceIds.length) {
      const deletedResources = await db.delete(resources).where(inArray(resources.id, allTargetResourceIds)).returning({ id: resources.id });
      console.log(`Deleted ${deletedResources.length} resources.`);
    }

    await pool.query("COMMIT");
    console.log("\nCleanup complete.");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) {
    console.error("Root cause:", cause.message);
    console.error(cause);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
