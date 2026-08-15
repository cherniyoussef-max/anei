import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { changeOrganizationMemberRole, revokeOrganizationMembership } from "@/server/services/organizations";
import { organizationRoles } from "@/modules/relationships/domain/permissions";

const idSchema = z.string().uuid();
const schema = z
  .object({
    role: z.enum(organizationRoles).optional(),
    revoke: z.literal(true).optional(),
  })
  .strict()
  .refine((data) => data.role !== undefined || data.revoke === true, { message: "role or revoke required" });

function statusFor(kind: "not_found" | "last_owner") {
  if (kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ error: "LAST_OWNER" }, { status: 409 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; membershipId: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("organizations.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const { id, membershipId } = await params;
  const orgId = idSchema.safeParse(id);
  const memberId = idSchema.safeParse(membershipId);
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!orgId.success || !memberId.success || !parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  if (parsed.data.revoke) {
    const result = await revokeOrganizationMembership(session.user.id, orgId.data, memberId.data);
    if (result.kind !== "ok") return statusFor(result.kind);
  } else if (parsed.data.role) {
    const result = await changeOrganizationMemberRole(session.user.id, orgId.data, memberId.data, parsed.data.role);
    if (result.kind !== "ok") return statusFor(result.kind);
  }

  return NextResponse.json({ ok: true });
}
