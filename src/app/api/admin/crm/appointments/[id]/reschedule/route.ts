import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { rescheduleAppointment } from "@/server/services/appointments";

const idSchema = z.string().uuid();
const bodySchema = z
  .object({
    organizationId: z.string().uuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  })
  .strict();

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

  const { organizationId, startAt, endAt } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const result = await rescheduleAppointment(session.user.id, actorRole, organizationId, id.data, new Date(startAt), new Date(endAt));
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ error: "INVALID_TRANSITION" }, { status: 409 });
  if (result.kind === "invalid_time_range") return NextResponse.json({ error: "INVALID_TIME_RANGE" }, { status: 422 });
  if (result.kind === "slot_conflict") return NextResponse.json({ error: "SLOT_CONFLICT" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "RESCHEDULE_FAILED" }, { status: 409 });
  return NextResponse.json({ ok: true });
}