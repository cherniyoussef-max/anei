import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getContactNotes, getCrmContact } from "@/server/queries/crm";
import { addCrmContactNote } from "@/server/services/crm";

const idSchema = z.string().uuid();
const orgQuerySchema = z.object({ organizationId: z.string().uuid(), page: z.coerce.number().int().positive().optional() });
const createSchema = z.object({ organizationId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).strict();

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

  const notes = await getContactNotes(id.data, org.data.page);
  return NextResponse.json(notes);
}

/** authorUserId is always the authenticated session's own id — never accepted from the request body. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = createSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const result = await addCrmContactNote(session.user.id, parsed.data.organizationId, id.data, parsed.data.body);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
