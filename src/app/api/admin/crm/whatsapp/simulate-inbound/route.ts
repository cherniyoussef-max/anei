import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import { simulateInboundWhatsAppMessage } from "@/server/services/whatsapp";

const schema = z
  .object({
    organizationId: z.string().uuid().optional(),
    fromPhone: z.string().trim().min(6).max(30),
    text: z.string().trim().min(1).max(4096),
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

  try {
    const message = await simulateInboundWhatsAppMessage(
      organizationId,
      parsed.data.fromPhone,
      parsed.data.text,
    );
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json({ error: "SIMULATION_FAILED", message: String(error) }, { status: 400 });
  }
}
