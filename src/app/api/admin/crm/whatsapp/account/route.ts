import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { getWhatsAppAccountForOrg } from "@/server/queries/whatsapp";
import { upsertWhatsAppAccount } from "@/server/services/whatsapp";
import { whatsappConfigured } from "@/server/whatsapp/config";

const upsertSchema = z
  .object({
    organizationId: z.string().uuid(),
    phoneNumberId: z.string().trim().min(1).max(128),
    businessAccountId: z.string().trim().min(1).max(128),
    displayPhoneNumber: z.string().trim().min(1).max(32).nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const account = await getWhatsAppAccountForOrg(organizationId);
  return NextResponse.json({
    configured: whatsappConfigured,
    canConfigure: true, // read gates below; writes enforce MANAGER+
    account: account
      ? {
          id: account.id,
          phoneNumberId: account.phoneNumberId,
          businessAccountId: account.businessAccountId,
          displayPhoneNumber: account.displayPhoneNumber,
          status: account.status,
          provider: account.provider,
          updatedAt: account.updatedAt,
        }
      : null,
    actorRole,
  });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = upsertSchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const { organizationId, ...data } = parsed.data;
  const actorRole = await resolveActorOrgRole(session.user.id, organizationId);
  const result = await upsertWhatsAppAccount(session.user.id, actorRole, organizationId, data);
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "conflict") return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
  if (result.kind !== "ok") return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}