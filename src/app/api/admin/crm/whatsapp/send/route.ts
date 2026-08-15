import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { sendWhatsAppTemplate } from "@/server/services/whatsapp";

const MAX_PARAMETERS = 32;
const MAX_PARAMETER_TEXT = 4_096;

const sendSchema = z
  .object({
    organizationId: z.string().uuid(),
    contactId: z.string().uuid(),
    templateId: z.string().min(1).max(256),
    language: z.string().trim().min(2).max(16),
    parameters: z.array(z.string().trim().max(MAX_PARAMETER_TEXT)).max(MAX_PARAMETERS).optional(),
    requestId: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = sendSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, ...data } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const result = await sendWhatsAppTemplate(session.user.id, actorRole, organizationId, data);

  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "not_found") return NextResponse.json({ error: "CONTACT_NOT_FOUND" }, { status: 404 });
  if (result.kind === "no_account") return NextResponse.json({ error: "NO_ACCOUNT" }, { status: 422 });
  if (result.kind === "no_phone") return NextResponse.json({ error: "CONTACT_NO_PHONE" }, { status: 422 });
  if (result.kind === "invalid_template") return NextResponse.json({ error: "INVALID_TEMPLATE" }, { status: 422 });
  if (result.kind === "invalid_parameters") return NextResponse.json({ error: "INVALID_PARAMETERS" }, { status: 422 });
  if (result.kind === "not_configured") return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (result.kind === "conflict") return NextResponse.json({ error: "REQUEST_ID_CONFLICT" }, { status: 409 });
  if (result.kind === "provider_error") {
    return NextResponse.json(
      { error: "PROVIDER_ERROR", providerErrorCode: result.providerErrorCode, providerErrorMessage: result.providerErrorMessage },
      { status: 502 },
    );
  }
  if (result.kind !== "ok") return NextResponse.json({ error: "SEND_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id });
}