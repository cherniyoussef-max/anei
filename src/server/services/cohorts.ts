import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, cohort, courses } from "@/server/db/schema";
import type { CohortStatus } from "@/modules/lms/domain/permissions";

type CohortMutationResult = { kind: "ok"; id: string } | { kind: "not_found" } | { kind: "invalid_course" };

/** MANAGER+ gate is enforced at the route (see admin/cohorts routes); this service assumes the caller is already authorized. */
export async function createCohort(
  actorUserId: string,
  organizationId: string | null,
  data: { courseId: string; name: string; startsAt?: Date | null; endsAt?: Date | null; capacity?: number | null },
): Promise<CohortMutationResult> {
  const course = await db.query.courses.findFirst({ where: eq(courses.id, data.courseId) });
  if (!course) return { kind: "invalid_course" };

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(cohort)
      .values({
        courseId: data.courseId,
        organizationId,
        name: data.name,
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        capacity: data.capacity ?? null,
        createdByUserId: actorUserId,
      })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "lms.cohort.create",
      entityType: "cohort",
      entityId: row.id,
      metadata: { organizationId, courseId: data.courseId },
    });
    return { kind: "ok", id: row.id };
  });
}

export async function setCohortStatus(actorUserId: string, organizationId: string | null, cohortId: string, status: CohortStatus): Promise<CohortMutationResult> {
  return db.transaction(async (tx) => {
    const filters = [eq(cohort.id, cohortId)];
    if (organizationId) filters.push(eq(cohort.organizationId, organizationId));
    const [existing] = await tx
      .select({ id: cohort.id })
      .from(cohort)
      .where(and(...filters))
      .limit(1);
    if (!existing) return { kind: "not_found" };

    await tx.update(cohort).set({ status, updatedAt: new Date() }).where(eq(cohort.id, cohortId));
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "lms.cohort.status.change",
      entityType: "cohort",
      entityId: cohortId,
      metadata: { status },
    });
    return { kind: "ok", id: cohortId };
  });
}

export type { CohortMutationResult };

// Advisory-lock key namespace, mirroring the organization-mutation lock
// pattern in server/services/organizations.ts, so `enrollStudent` (which
// joins a cohort) can serialize concurrent capacity checks for the same
// cohort without a second lock namespace colliding with the org-membership
// one.
export function cohortAdvisoryLockKey(cohortId: string) {
  return sql`select pg_advisory_xact_lock(hashtext(${"cohort:" + cohortId}))`;
}
