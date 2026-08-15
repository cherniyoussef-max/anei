import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { invalidateAdminUserCaches } from "@/server/cache/admin-users";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { adminSetPersonaStatus, adminSetPrimaryPersona } from "@/server/services/personas";
import { personas, personaStatuses } from "@/modules/personas/domain/permissions";

const idSchema = z.string().uuid();
const schema = z
  .object({
    persona: z.enum(personas),
    status: z.enum(personaStatuses).optional(),
    makePrimary: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.status !== undefined || data.makePrimary === true, {
    message: "status or makePrimary required",
  });

/**
 * Admin persona management: status changes (approve/reject/suspend/reactivate)
 * and primary-persona reassignment. Gated by the "personas.manage" permission
 * (both ADMIN and SUPER_ADMIN, unlike role changes which are privilege-
 * escalation and stay SUPER_ADMIN-only). Always audited; DB is authoritative.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("personas.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  if (parsed.data.status) {
    const result = await adminSetPersonaStatus(session.user.id, id.data, parsed.data.persona, parsed.data.status);
    if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (parsed.data.makePrimary) {
    const result = await adminSetPrimaryPersona(session.user.id, id.data, parsed.data.persona);
    if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await invalidateAdminUserCaches(id.data);
  return NextResponse.json({ ok: true });
}
