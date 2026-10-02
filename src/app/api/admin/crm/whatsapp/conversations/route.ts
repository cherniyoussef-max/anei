import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor } from "@/server/auth/admin";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import {
  getWhatsAppConversations,
  getWhatsAppDirectoryContacts,
  getOrCreateWhatsAppAccountForOrg,
} from "@/server/queries/whatsapp";
import { whatsappConfigured } from "@/server/whatsapp/config";

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const orgParam = searchParams.get("organizationId");
  let organizationId = orgParam;

  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    const primaryOrg = await getPrimaryOrganization();
    if (!primaryOrg) return NextResponse.json({ error: "NO_ORGANIZATION" }, { status: 404 });
    organizationId = primaryOrg.id;
  }

  // Ensure account exists
  const account = await getOrCreateWhatsAppAccountForOrg(organizationId);

  const [conversations, directory] = await Promise.all([
    getWhatsAppConversations(organizationId),
    getWhatsAppDirectoryContacts(organizationId),
  ]);

  return NextResponse.json({
    organizationId,
    account: {
      phoneNumberId: account.phoneNumberId,
      businessAccountId: account.businessAccountId,
      displayPhoneNumber: account.displayPhoneNumber,
      status: account.status,
    },
    metaConfigured: whatsappConfigured,
    conversations,
    directory,
  });
}
