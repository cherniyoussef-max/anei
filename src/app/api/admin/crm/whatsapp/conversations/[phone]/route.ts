import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor } from "@/server/auth/admin";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import { getWhatsAppConversationMessages } from "@/server/queries/whatsapp";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> },
) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { phone } = await params;
  if (!phone) return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  let organizationId = searchParams.get("organizationId");

  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    const primaryOrg = await getPrimaryOrganization();
    if (!primaryOrg) return NextResponse.json({ error: "NO_ORGANIZATION" }, { status: 404 });
    organizationId = primaryOrg.id;
  }

  const messages = await getWhatsAppConversationMessages(organizationId, phone);
  return NextResponse.json({ messages });
}
