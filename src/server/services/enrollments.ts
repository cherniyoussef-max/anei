import { and, count, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { admission, auditLogs, cohort, cohortMembership, courses, crmContact, crmContactActivity, enrollments } from "@/server/db/schema";
import type { EnrollmentSource } from "@/modules/lms/domain/permissions";
import { hasActivePersona } from "@/server/queries/personas";
import { cohortAdvisoryLockKey } from "@/server/services/cohorts";

type EnrollResult =
  | { kind: "ok"; enrollmentId: string; created: boolean }
  | { kind: "invalid_persona" }
  | { kind: "invalid_course" }
  | { kind: "invalid_cohort" }
  | { kind: "cohort_full" };

type EnrollContactResult = EnrollResult | { kind: "invalid_contact" };

/**
 * Explicit enrollment creation — the single authorized path that inserts an
 * `enrollments` row outside the existing payment flow
 * (server/services/checkout.ts's `grantPaidOrderTx`, unchanged). Neither an
 * ACCEPTED admission nor a consumed invitation nor a STUDENT persona alone
 * ever reaches this function automatically; it is only ever called from an
 * explicit admin/org-manager action (see docs/premium/ROADMAP.md Phase 7
 * §E/§N). The `enrollments.userId/courseId` unique index makes the insert
 * itself idempotent under concurrency — two concurrent calls for the same
 * user/course can never create two rows, and this function reports the
 * pre-existing row as `created: false` rather than erroring.
 *
 * When `cohortId` is provided, the cohort must belong to the same course
 * (and, if `organizationId` is set, the same organization) — this is the
 * cross-org IDOR boundary for cohort enrollment. Capacity, when set, is
 * enforced transactionally under a per-cohort advisory lock (mirrors
 * server/services/organizations.ts's last-owner-protection lock) so two
 * concurrent enrollments can never both observe capacity as free and both
 * proceed past it.
 */
export async function enrollStudent(
  actorUserId: string,
  organizationId: string | null,
  input: { userId: string; courseId: string; cohortId?: string | null; source: EnrollmentSource; contactId?: string | null },
): Promise<EnrollResult> {
  const [studentOk, course] = await Promise.all([
    hasActivePersona(input.userId, "STUDENT"),
    db.query.courses.findFirst({ where: eq(courses.id, input.courseId) }),
  ]);
  if (!studentOk) return { kind: "invalid_persona" };
  if (!course) return { kind: "invalid_course" };

  return db.transaction(async (tx) => {
    if (input.cohortId) {
      await tx.execute(cohortAdvisoryLockKey(input.cohortId));

      const cohortFilters = [eq(cohort.id, input.cohortId), eq(cohort.courseId, input.courseId)];
      if (organizationId) cohortFilters.push(eq(cohort.organizationId, organizationId));
      const [cohortRow] = await tx
        .select()
        .from(cohort)
        .where(and(...cohortFilters))
        .limit(1);
      if (!cohortRow) return { kind: "invalid_cohort" };

      if (cohortRow.capacity !== null) {
        const [{ value: memberCount }] = await tx
          .select({ value: count() })
          .from(cohortMembership)
          .where(eq(cohortMembership.cohortId, input.cohortId));
        if (memberCount >= cohortRow.capacity) return { kind: "cohort_full" };
      }
    }

    const [existing] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.userId, input.userId), eq(enrollments.courseId, input.courseId)))
      .limit(1);

    let enrollmentId = existing?.id;
    let created = false;
    if (!enrollmentId) {
      const [inserted] = await tx
        .insert(enrollments)
        .values({ userId: input.userId, courseId: input.courseId, source: input.source })
        .onConflictDoNothing({ target: [enrollments.userId, enrollments.courseId] })
        .returning({ id: enrollments.id });
      if (inserted) {
        enrollmentId = inserted.id;
        created = true;
      } else {
        const [raced] = await tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.userId, input.userId), eq(enrollments.courseId, input.courseId)))
          .limit(1);
        enrollmentId = raced!.id;
      }
    }

    if (input.cohortId) {
      await tx
        .insert(cohortMembership)
        .values({ cohortId: input.cohortId, enrollmentId })
        .onConflictDoNothing({ target: [cohortMembership.enrollmentId] });
    }

    if (created) {
      await tx.insert(auditLogs).values({
        actorUserId,
        action: "lms.enrollment.create",
        entityType: "enrollment",
        entityId: enrollmentId,
        metadata: { userId: input.userId, courseId: input.courseId, cohortId: input.cohortId ?? null, source: input.source },
      });
      if (input.contactId) {
        await tx.insert(crmContactActivity).values({
          contactId: input.contactId,
          actorUserId,
          type: "COURSE_ENROLLED",
          metadata: { courseId: input.courseId, cohortId: input.cohortId ?? null },
        });
      }
    }

    return { kind: "ok", enrollmentId, created };
  });
}

/**
 * The admission->enrollment boundary (docs/premium/ROADMAP.md Phase 7 §N):
 * an ACCEPTED admission plus a consumed invitation (which sets
 * `crmContact.linkedUserId`) does NOT itself enroll a student — this
 * function is the one explicit admin action that does, and it re-validates
 * every prerequisite server-side rather than trusting a client-supplied
 * userId. `contactId` is always resolved to its `linkedUserId` here, never
 * accepted directly from the caller as a `userId`.
 */
export async function enrollContact(
  actorUserId: string,
  organizationId: string,
  input: { contactId: string; courseId: string; cohortId?: string | null },
): Promise<EnrollContactResult> {
  const [contact] = await db
    .select({ id: crmContact.id, linkedUserId: crmContact.linkedUserId, status: crmContact.status })
    .from(crmContact)
    .where(and(eq(crmContact.id, input.contactId), eq(crmContact.organizationId, organizationId)))
    .limit(1);
  if (!contact || contact.status !== "ACTIVE" || !contact.linkedUserId) return { kind: "invalid_contact" };

  const [accepted] = await db
    .select({ id: admission.id })
    .from(admission)
    .where(and(eq(admission.contactId, input.contactId), eq(admission.organizationId, organizationId), eq(admission.decision, "ACCEPTED")))
    .limit(1);
  if (!accepted) return { kind: "invalid_contact" };

  return enrollStudent(actorUserId, organizationId, {
    userId: contact.linkedUserId,
    courseId: input.courseId,
    cohortId: input.cohortId ?? null,
    source: "ORGANIZATION",
    contactId: input.contactId,
  });
}
