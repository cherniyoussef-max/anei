import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole, searchAppointments } from "@/server/queries/admission";
import { createAppointment } from "@/server/services/appointments";

const searchSchema = z.object({
  organizationId: z.string().uuid(),
  q: z.string().max(100).optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  contactId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(["createdAt", "startAt", "updatedAt"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const createSchema = z
  .object({
    organizationId: z.string().uuid(),
    contactId: z.string().uuid(),
    assignedToUserId: z.string().uuid(),
    type: z.enum(["ASSESSMENT", "INFO_MEETING", "FOLLOW_UP", "OTHER"]),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const result = await searchAppointments(parsed.data);
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

  const { organizationId, startAt, endAt, ...data } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const result = await createAppointment(session.user.id, actorRole, organizationId, {
    ...data,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
  });
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "invalid_contact") return NextResponse.json({ error: "INVALID_CONTACT" }, { status: 422 });
  if (result.kind === "invalid_assignee") return NextResponse.json({ error: "INVALID_ASSIGNEE" }, { status: 422 });
  if (result.kind === "invalid_time_range") return NextResponse.json({ error: "INVALID_TIME_RANGE" }, { status: 422 });
  if (result.kind === "slot_conflict") return NextResponse.json({ error: "SLOT_CONFLICT" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}