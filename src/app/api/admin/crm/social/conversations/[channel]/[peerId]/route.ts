import { NextResponse } from "next/server";
import { getAdminSessionFor } from "@/server/auth/admin";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import { getSocialConversationMessages } from "@/server/queries/social-messaging";
import type { SocialChannel } from "@/server/social/normalize";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channel: string; peerId: string }> },
) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { channel, peerId } = await params;
  if (channel !== "INSTAGRAM" && channel !== "MESSENGER") {
    return NextResponse.json({ error: "INVALID_CHANNEL" }, { status: 400 });
  }

  const url = new URL(request.url);
  let organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    const primary = await getPrimaryOrganization();
    if (!primary) return NextResponse.json({ error: "NO_ORGANIZATION" }, { status: 404 });
    organizationId = primary.id;
  }

  const messages = await getSocialConversationMessages(organizationId, channel as SocialChannel, decodeURIComponent(peerId));

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      channel: m.channel,
      direction: m.direction,
      status: m.status,
      textPreview: m.textPreview,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      senderId: m.senderId,
      recipientId: m.recipientId,
      senderName: m.senderName,
      senderUsername: m.senderUsername,
      providerMessageId: m.providerMessageId,
      sentAt: m.sentAt?.toISOString() ?? null,
      deliveredAt: m.deliveredAt?.toISOString() ?? null,
      readAt: m.readAt?.toISOString() ?? null,
      failedAt: m.failedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
