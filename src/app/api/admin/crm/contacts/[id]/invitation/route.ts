import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { createAccountInvitation } from "@/server/services/account-invitations";

const idSchema = z.string().uuid();
const bodySchema = z.object({ organizationId: z.string().uuid() }).strict();

/** Creates and attempts delivery of an account invitation for an eligible CRM contact. Every eligibility fact is reloaded server-side. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const actorRole = await resolveActorOrgRole(session.user.id, parsed.data.organizationId);
  const result = await createAccountInvitation(session.user.id, actorRole, parsed.data.organizationId, id.data);

  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind === "already_linked") return NextResponse.json({ error: "ALREADY_LINKED" }, { status: 409 });
  if (result.kind === "not_eligible") return NextResponse.json({ error: "NOT_ELIGIBLE" }, { status: 422 });
  if (result.kind === "no_phone") return NextResponse.json({ error: "CONTACT_NO_PHONE" }, { status: 422 });
  if (result.kind === "not_configured") return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (result.kind === "conflict") return NextResponse.json({ error: "INVITATION_ALREADY_ACTIVE" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "INVITATION_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id, sent: result.sent });
}
