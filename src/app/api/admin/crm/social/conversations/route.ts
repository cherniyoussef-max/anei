import { NextResponse } from "next/server";
import { getAdminSessionFor } from "@/server/auth/admin";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import {
  getSocialConversations,
} from "@/server/queries/social-messaging";
import type { SocialChannel } from "@/server/social/normalize";

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const orgId = url.searchParams.get("organizationId");
  const channelParam = url.searchParams.get("channel");

  let organizationId = orgId;
  if (!organizationId) {
    const primary = await getPrimaryOrganization();
    if (!primary) return NextResponse.json({ error: "NO_ORGANIZATION" }, { status: 404 });
    organizationId = primary.id;
  }

  let channelFilter: SocialChannel | undefined;
  if (channelParam === "INSTAGRAM" || channelParam === "MESSENGER") {
    channelFilter = channelParam;
  }

  const conversations = await getSocialConversations(organizationId, channelFilter);

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      ...c,
      lastMessage: c.lastMessage
        ? {
            ...c.lastMessage,
            createdAt: c.lastMessage.createdAt.toISOString(),
          }
        : null,
    })),
  });
}
