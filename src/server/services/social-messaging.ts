import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
    socialMessage,
  socialWebhookEvent,
} from "@/server/db/schema";
import {
  getOrCreateSocialAccountForOrg,
} from "@/server/queries/social-messaging";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import {
  type NormalizedSocialEvent,
  type SocialChannel,
} from "@/server/social/normalize";
import {
  sendSocialTextMessage as providerSendTextMessage,
} from "@/server/social/provider";

export type SendSocialMessageInput = {
  organizationId: string;
  channel: SocialChannel;
  recipientId: string;
  text: string;
  createdByUserId?: string;
  contactId?: string;
  senderName?: string;
};

export async function sendSocialTextMessageService(input: SendSocialMessageInput) {
  const { organizationId, channel, recipientId, text, createdByUserId, contactId, senderName } = input;

  const account = await getOrCreateSocialAccountForOrg(organizationId, channel);

  // Send via Meta Provider (mock or live)
  const result = await providerSendTextMessage({
    channel,
    recipientId,
    text,
  });

  const [row] = await db
    .insert(socialMessage)
    .values({
      organizationId,
      accountId: account.id,
      contactId: contactId ?? null,
      channel,
      direction: "OUTBOUND",
      status: result.isMock ? "DELIVERED" : "SENT",
      providerMessageId: result.providerMessageId,
      senderId: account.externalAccountId,
      recipientId,
      senderName: senderName ?? account.accountName,
      textPreview: text,
      sentAt: new Date(),
      deliveredAt: result.isMock ? new Date() : null,
      createdByUserId: createdByUserId ?? null,
    })
    .returning();

  

  return row;
}

export async function ingestSocialWebhookEvents(
  events: NormalizedSocialEvent[],
  organizationIdFallback?: string,
) {
  let processed = 0;
  let duplicates = 0;

  // Resolve organization
  let defaultOrgId = organizationIdFallback;
  if (!defaultOrgId) {
    const primary = await getPrimaryOrganization();
    defaultOrgId = primary?.id;
  }
  if (!defaultOrgId) {
    return { processed: 0, duplicates: 0 };
  }

  for (const ev of events) {
    const orgId = defaultOrgId;

    const outcome = await db.transaction(async (tx) => {
      // Atomic idempotency claim: insert with onConflictDoNothing on stableKey
      const [claimed] = await tx
        .insert(socialWebhookEvent)
        .values({
          stableKey: ev.stableKey,
          channel: ev.channel,
          organizationId: orgId,
          receivedAt: new Date(),
          processedAt: new Date(),
        })
        .onConflictDoNothing({ target: socialWebhookEvent.stableKey })
        .returning({ id: socialWebhookEvent.id });

      if (!claimed) {
        return "duplicate" as const;
      }

      if (ev.kind === "inbound_message") {
        const account = await getOrCreateSocialAccountForOrg(orgId, ev.channel, tx);

        // Try to find if an existing thread had a contact linked
        const [prev] = await tx
          .select({ contactId: socialMessage.contactId })
          .from(socialMessage)
          .where(
            and(
              eq(socialMessage.organizationId, orgId),
              eq(socialMessage.channel, ev.channel),
              eq(socialMessage.senderId, ev.senderId),
            ),
          )
          .limit(1);

        await tx
          .insert(socialMessage)
          .values({
            organizationId: orgId,
            accountId: account.id,
            contactId: prev?.contactId ?? null,
            channel: ev.channel,
            direction: "INBOUND",
            status: "DELIVERED",
            providerMessageId: ev.providerMessageId,
            senderId: ev.senderId,
            recipientId: ev.recipientId,
            senderName:
              ev.senderName ??
              `${ev.channel === "INSTAGRAM" ? "Instagram" : "Messenger"} User ${ev.senderId.slice(-4)}`,
            senderUsername: ev.senderUsername ?? null,
            senderAvatarUrl: ev.senderAvatarUrl ?? null,
            textPreview: ev.text,
            mediaUrl: ev.mediaUrl ?? null,
            mediaType: ev.mediaType ?? null,
            deliveredAt: ev.timestamp,
            createdAt: ev.timestamp,
          })
          .onConflictDoNothing();

        return "processed" as const;
      } else if (ev.kind === "status_update") {
        await tx
          .update(socialMessage)
          .set({
            status: ev.status,
            ...(ev.status === "DELIVERED" ? { deliveredAt: ev.timestamp } : {}),
            ...(ev.status === "READ" ? { readAt: ev.timestamp } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(socialMessage.channel, ev.channel),
              eq(socialMessage.providerMessageId, ev.providerMessageId),
            ),
          );

        return "processed" as const;
      }

      return "skipped" as const;
    });

    if (outcome === "duplicate") {
      duplicates++;
    } else if (outcome === "processed") {
      processed++;
    }
  }

  return { processed, duplicates };
}

export type SimulateSocialInboundParams = {
  organizationId: string;
  channel: SocialChannel;
  senderId?: string;
  senderName: string;
  senderUsername?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: "IMAGE" | "AUDIO" | "FILE" | "VIDEO";
  contactId?: string;
};

export async function simulateSocialInboundMessage(params: SimulateSocialInboundParams) {
  const {
    organizationId,
    channel,
    senderName,
    senderUsername,
    text,
    mediaUrl,
    mediaType,
    contactId,
  } = params;

  const account = await getOrCreateSocialAccountForOrg(organizationId, channel);
  const senderId =
    params.senderId?.trim() ||
    `sim_${channel.toLowerCase()}_${Date.now().toString(36)}`;
  const providerMessageId = `sim_mid_${channel.toLowerCase()}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const [row] = await db
    .insert(socialMessage)
    .values({
      organizationId,
      accountId: account.id,
      contactId: contactId ?? null,
      channel,
      direction: "INBOUND",
      status: "DELIVERED",
      providerMessageId,
      senderId,
      recipientId: account.externalAccountId,
      senderName: senderName.trim(),
      senderUsername: senderUsername?.trim() || null,
      textPreview: text.trim(),
      mediaUrl: mediaUrl?.trim() || null,
      mediaType: mediaType ?? null,
      deliveredAt: new Date(),
    })
    .returning();

  return row;
}
