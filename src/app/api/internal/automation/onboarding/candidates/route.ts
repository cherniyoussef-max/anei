import { z } from "zod";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/server/db";
import { enrollments, organizationMembership, user as userTable, courses } from "@/server/db/schema";
import { authenticateInternalAutomation, requireAutomationScope, json } from "@/server/automation/internal-auth";
import { AUTOMATION_ONBOARDING_READ } from "@/server/mcp/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ sinceDays: z.number().int().min(1).max(90).default(30) }).strict();

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateInternalAutomation(request);
  if (!auth.ok) return auth.response;

  const forbidden = await requireAutomationScope(auth.actor, AUTOMATION_ONBOARDING_READ, request);
  if (forbidden) return forbidden;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request" });

  if (!auth.actor.organizationId) return json(403, { error: "Forbidden: credential is not organization-scoped" });

  const since = new Date(Date.now() - parsed.data.sinceDays * 24 * 60 * 60 * 1000);

  // Onboarding candidates: org members who enrolled in at least one course in
  // the window. enrollments are not org-scoped, so the org boundary comes from
  // ACTIVE organization membership — a user outside the org can never appear.
  const rows = await db
    .selectDistinctOn([userTable.id], {
      userId: userTable.id,
      name: userTable.name,
      locale: userTable.locale,
      enrolledAt: enrollments.enrolledAt,
      courseId: courses.id,
      courseTitleFr: courses.titleFr,
      courseTitleAr: courses.titleAr,
    })
    .from(userTable)
    .innerJoin(organizationMembership, and(
      eq(organizationMembership.userId, userTable.id),
      eq(organizationMembership.organizationId, auth.actor.organizationId),
      eq(organizationMembership.status, "ACTIVE"),
    ))
    .innerJoin(enrollments, eq(enrollments.userId, userTable.id))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(gte(enrollments.enrolledAt, since))
    .orderBy(asc(userTable.id), asc(enrollments.enrolledAt))
    .limit(50);

  return json(200, {
    candidates: rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      locale: row.locale,
      enrolledAt: row.enrolledAt.toISOString(),
      courseId: row.courseId,
      courseTitleFr: row.courseTitleFr,
      courseTitleAr: row.courseTitleAr,
    })),
  });
}