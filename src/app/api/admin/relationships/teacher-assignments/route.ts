import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { assignTeacher } from "@/server/services/teacher-assignments";
import { canManageTeacherAssignments } from "@/modules/lms/domain/permissions";

const schema = z.object({ organizationId: z.string().uuid(), teacherUserId: z.string().uuid(), courseId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("relationships.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, teacherUserId, courseId } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  if (!canManageTeacherAssignments(actorRole)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const result = await assignTeacher(session.user.id, teacherUserId, courseId, organizationId);
    if (result.kind === "invalid_persona") return NextResponse.json({ error: "INVALID_PERSONA" }, { status: 422 });
    if (result.kind === "invalid_course") return NextResponse.json({ error: "INVALID_COURSE" }, { status: 422 });
    if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
