import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { searchInvitations } from "@/server/queries/invitations";
import { createInvitation } from "@/server/services/invitations";

const searchSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(["PENDING_SEND", "SENT", "VERIFIED", "CONSUMED", "REVOKED", "EXPIRED"]).optional(),
  contactId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const createSchema = z
  .object({
    organizationId: z.string().uuid(),
    contactId: z.string().uuid(),
    admissionId: z.string().uuid().nullable().optional(),
    locale: z.enum(["fr", "ar"]).optional(),
  })
  .strict();

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const result = await searchInvitations(parsed.data.organizationId, {
    status: parsed.data.status,
    contactId: parsed.data.contactId,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = createSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, ...data } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const result = await createInvitation(session.user.id, actorRole, organizationId, data);
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "invalid_contact") return NextResponse.json({ error: "INVALID_CONTACT" }, { status: 422 });
  if (result.kind === "not_eligible") return NextResponse.json({ error: "NOT_ELIGIBLE" }, { status: 422 });
  if (result.kind === "no_phone") return NextResponse.json({ error: "CONTACT_NO_PHONE" }, { status: 422 });
  if (result.kind === "already_linked") return NextResponse.json({ error: "ALREADY_LINKED" }, { status: 409 });
  if (result.kind === "conflict") return NextResponse.json({ error: "INVITATION_EXISTS" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}