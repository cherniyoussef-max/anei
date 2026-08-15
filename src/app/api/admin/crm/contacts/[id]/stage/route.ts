import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { moveCrmContactStage } from "@/server/services/crm";

const idSchema = z.string().uuid();
const bodySchema = z.object({ organizationId: z.string().uuid(), stageId: z.string().uuid() }).strict();

/** The stage is looked up scoped to organizationId; a foreign-organization stageId simply doesn't match and yields INVALID_STAGE. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await moveCrmContactStage(session.user.id, parsed.data.organizationId, id.data, parsed.data.stageId);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind === "invalid_stage") return NextResponse.json({ error: "INVALID_STAGE" }, { status: 422 });
  return NextResponse.json({ ok: true });
}
