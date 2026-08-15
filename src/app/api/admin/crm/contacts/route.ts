import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { searchCrmContacts, getTagsForContacts } from "@/server/queries/crm";
import { createCrmContact } from "@/server/services/crm";

const searchSchema = z.object({
  organizationId: z.string().uuid(),
  q: z.string().max(100).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  stageId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  sort: z.enum(["createdAt", "updatedAt"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const createSchema = z
  .object({
    organizationId: z.string().uuid(),
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(180).nullable().optional(),
    phone: z.string().trim().min(3).max(40).nullable().optional(),
    linkedUserId: z.string().uuid().nullable().optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    currentStageId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const result = await searchCrmContacts(parsed.data);
  const tagsByContact = await getTagsForContacts(result.items.map((c) => c.id));
  const items = result.items.map((contact) => ({ ...contact, tags: tagsByContact.get(contact.id) ?? [] }));
  return NextResponse.json({ ...result, items });
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
  const result = await createCrmContact(session.user.id, organizationId, data);
  if (result.kind === "invalid_assignee") return NextResponse.json({ error: "INVALID_ASSIGNEE" }, { status: 422 });
  if (result.kind === "invalid_stage") return NextResponse.json({ error: "INVALID_STAGE" }, { status: 422 });
  if (result.kind === "conflict") return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
