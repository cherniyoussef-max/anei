import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { listCrmPipelines, listCrmPipelineStages } from "@/server/queries/crm";
import { createCrmPipeline } from "@/server/services/crm";

const orgQuerySchema = z.object({ organizationId: z.string().uuid() });
const createSchema = z.object({ organizationId: z.string().uuid(), name: z.string().trim().min(1).max(120) }).strict();

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const org = orgQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!org.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const pipelines = await listCrmPipelines(org.data.organizationId);
  const withStages = await Promise.all(
    pipelines.map(async (pipeline) => ({ ...pipeline, stages: await listCrmPipelineStages(pipeline.id) })),
  );
  return NextResponse.json({ pipelines: withStages });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = createSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const result = await createCrmPipeline(session.user.id, parsed.data.organizationId, parsed.data.name);
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
