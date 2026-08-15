import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getAssessment, resolveActorOrgRole } from "@/server/queries/admission";
import { updateAssessment } from "@/server/services/assessments";

const idSchema = z.string().uuid();
const orgQuerySchema = z.object({ organizationId: z.string().uuid() });
const updateSchema = z
  .object({
    organizationId: z.string().uuid(),
    score: z.number().int().min(0).nullable().optional(),
    maxScore: z.number().int().min(0).nullable().optional(),
    summary: z.string().trim().max(5000).nullable().optional(),
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

  const detail = await getAssessment(org.data.organizationId, id.data);
  if (!detail) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(detail);
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
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const result = await updateAssessment(session.user.id, actorRole, organizationId, id.data, data);
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ error: "INVALID_TRANSITION" }, { status: 409 });
  if (result.kind === "invalid_score") return NextResponse.json({ error: "INVALID_SCORE" }, { status: 422 });
  if (result.kind !== "ok") return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
  return NextResponse.json({ ok: true });
}