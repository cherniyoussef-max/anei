import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { createCrmPipelineStage } from "@/server/services/crm";

const idSchema = z.string().uuid();
const createSchema = z
  .object({ organizationId: z.string().uuid(), name: z.string().trim().min(1).max(120), position: z.number().int().min(0).max(1000) })
  .strict();

/** pipelineId is re-checked against organizationId in the service layer — a foreign-organization pipelineId yields NOT_FOUND. */
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

  const result = await createCrmPipelineStage(session.user.id, parsed.data.organizationId, id.data, parsed.data.name, parsed.data.position);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
