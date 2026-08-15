import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getContactTags, getCrmContact } from "@/server/queries/crm";
import { updateCrmContact } from "@/server/services/crm";

const idSchema = z.string().uuid();
const orgQuerySchema = z.object({ organizationId: z.string().uuid() });
const updateSchema = z
  .object({
    organizationId: z.string().uuid(),
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(180).nullable().optional(),
    phone: z.string().trim().min(3).max(40).nullable().optional(),
  })
  .strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const url = new URL(request.url);
  const org = orgQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!org.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const contact = await getCrmContact(org.data.organizationId, id.data);
  if (!contact) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const tags = await getContactTags(contact.id);
  return NextResponse.json({ contact, tags });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = updateSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, ...data } = parsed.data;
  const result = await updateCrmContact(session.user.id, organizationId, id.data, data);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
