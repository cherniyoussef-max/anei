import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { listCohorts } from "@/server/queries/cohorts";
import { createCohort } from "@/server/services/cohorts";
import { canManageCohorts } from "@/modules/lms/domain/permissions";

const schema = z
  .object({
    organizationId: z.string().uuid(),
    courseId: z.string().uuid(),
    name: z.string().trim().min(2).max(180),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    capacity: z.number().int().positive().max(100_000).nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const session = await getAdminSessionFor("cohorts.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const organizationId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("organizationId"));
  if (!organizationId.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const cohorts = await listCohorts(organizationId.data);
  return NextResponse.json({ cohorts });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("cohorts.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, courseId, name, startsAt, endsAt, capacity } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  if (!canManageCohorts(actorRole)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const result = await createCohort(session.user.id, organizationId, {
    courseId,
    name,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    capacity: capacity ?? null,
  });
  if (result.kind === "invalid_course") return NextResponse.json({ error: "INVALID_COURSE" }, { status: 422 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
