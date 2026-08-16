import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { enrollContact } from "@/server/services/enrollments";
import { canManageCohorts } from "@/modules/lms/domain/permissions";

const schema = z
  .object({
    organizationId: z.string().uuid(),
    contactId: z.string().uuid(),
    courseId: z.string().uuid(),
    cohortId: z.string().uuid().nullable().optional(),
  })
  .strict();

/**
 * Funnel terminal step (docs/premium/ROADMAP.md Phase 7): an admin/org-
 * manager explicitly enrolls an already-onboarded contact (ACCEPTED
 * admission + linked ANEI account) into a course, optionally into a cohort.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, contactId, courseId, cohortId } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  if (!canManageCohorts(actorRole)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const result = await enrollContact(session.user.id, organizationId, { contactId, courseId, cohortId: cohortId ?? null });
  if (result.kind === "invalid_contact") return NextResponse.json({ error: "INVALID_CONTACT" }, { status: 422 });
  if (result.kind === "invalid_persona") return NextResponse.json({ error: "INVALID_PERSONA" }, { status: 422 });
  if (result.kind === "invalid_course") return NextResponse.json({ error: "INVALID_COURSE" }, { status: 422 });
  if (result.kind === "invalid_cohort") return NextResponse.json({ error: "INVALID_COHORT" }, { status: 422 });
  if (result.kind === "cohort_full") return NextResponse.json({ error: "COHORT_FULL" }, { status: 409 });
  return NextResponse.json({ enrollmentId: result.enrollmentId, created: result.created }, { status: result.created ? 201 : 200 });
}
