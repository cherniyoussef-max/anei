import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { detachCrmContactTag } from "@/server/services/crm";

const idSchema = z.string().uuid();
const bodySchema = z.object({ organizationId: z.string().uuid() }).strict();

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; tagId: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const { id, tagId } = await params;
  const idParsed = idSchema.safeParse(id);
  const tagIdParsed = idSchema.safeParse(tagId);
  if (!idParsed.success || !tagIdParsed.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await detachCrmContactTag(session.user.id, parsed.data.organizationId, idParsed.data, tagIdParsed.data);
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
