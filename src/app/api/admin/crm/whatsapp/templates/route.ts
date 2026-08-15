import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { listWhatsAppTemplates } from "@/server/queries/whatsapp";
import { syncWhatsAppTemplates } from "@/server/services/whatsapp";

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const templates = await listWhatsAppTemplates(organizationId);
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const schema = z.object({ organizationId: z.string().uuid() }).strict();
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const actorRole = await resolveActorOrgRole(session.user.id, parsed.data.organizationId);
  const result = await syncWhatsAppTemplates(session.user.id, actorRole, parsed.data.organizationId);
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "no_account") return NextResponse.json({ error: "NO_ACCOUNT" }, { status: 422 });
  if (result.kind === "not_configured") return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (result.kind === "provider_error") {
    return NextResponse.json({ error: "PROVIDER_ERROR", providerErrorCode: result.providerErrorCode, providerErrorMessage: result.providerErrorMessage }, { status: 502 });
  }
  if (result.kind !== "ok") return NextResponse.json({ error: "SYNC_FAILED" }, { status: 409 });
  return NextResponse.json({ imported: result.imported });
}