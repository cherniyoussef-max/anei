import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { createParentStudentLink } from "@/server/services/relationships";
import { parentRelationshipTypes } from "@/modules/relationships/domain/permissions";

const schema = z
  .object({
    parentUserId: z.string().uuid(),
    studentUserId: z.string().uuid(),
    relationshipType: z.enum(parentRelationshipTypes),
  })
  .strict()
  .refine((data) => data.parentUserId !== data.studentUserId, { message: "parentUserId and studentUserId must differ" });

/** Admin-managed only in Phase 2 — no self-service invitation/OTP flow. */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("relationships.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await createParentStudentLink(session.user.id, parsed.data.parentUserId, parsed.data.studentUserId, parsed.data.relationshipType);
    if (result.kind === "invalid_persona") return NextResponse.json({ error: "INVALID_PERSONA" }, { status: 422 });
    if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
