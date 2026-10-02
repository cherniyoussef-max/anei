import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import { sendWhatsAppTextMessage } from "@/server/services/whatsapp";

const schema = z
  .object({
    organizationId: z.string().uuid().optional(),
    toPhone: z.string().trim().min(6).max(30),
    text: z.string().trim().min(1).max(4096),
    contactId: z.string().uuid().optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  let organizationId = parsed.data.organizationId;
  if (!organizationId) {
    const primaryOrg = await getPrimaryOrganization();
    if (!primaryOrg) return NextResponse.json({ error: "NO_ORGANIZATION" }, { status: 404 });
    organizationId = primaryOrg.id;
  }

  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const result = await sendWhatsAppTextMessage(session.user.id, actorRole, organizationId, {
    toPhone: parsed.data.toPhone,
    text: parsed.data.text,
    contactId: parsed.data.contactId,
  });

  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "no_account") return NextResponse.json({ error: "NO_ACCOUNT" }, { status: 422 });
  if (result.kind === "no_phone") return NextResponse.json({ error: "INVALID_PHONE" }, { status: 422 });
  if (result.kind === "invalid_parameters") return NextResponse.json({ error: "INVALID_PARAMETERS" }, { status: 422 });
  if (result.kind === "provider_error") {
    return NextResponse.json(
      { error: "PROVIDER_ERROR", providerErrorCode: result.providerErrorCode, providerErrorMessage: result.providerErrorMessage },
      { status: 502 },
    );
  }
  if (result.kind !== "ok") return NextResponse.json({ error: "SEND_FAILED" }, { status: 409 });

  return NextResponse.json({ ok: true, id: result.id });
}
