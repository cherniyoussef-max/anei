import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  socialChannelAccount,
  socialMessage,
  type SocialChannelAccountRow,
  type SocialMessageRow,
} from "@/server/db/schema";
import type { SocialChannel } from "@/server/social/normalize";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getSocialAccountForOrg(
  organizationId: string,
  channel: SocialChannel,
  client: DbClient = db,
): Promise<SocialChannelAccountRow | undefined> {
  const [row] = await client
    .select()
    .from(socialChannelAccount)
    .where(
      and(
        eq(socialChannelAccount.organizationId, organizationId),
        eq(socialChannelAccount.channel, channel),
      ),
    )
    .limit(1);
  return row;
}

export async function getOrCreateSocialAccountForOrg(
  organizationId: string,
  channel: SocialChannel,
  client: DbClient = db,
): Promise<SocialChannelAccountRow> {
  const existing = await getSocialAccountForOrg(organizationId, channel, client);
  if (existing) return existing;

  const defaultName =
    channel === "INSTAGRAM" ? "@anei_academie" : "Page Facebook ANEI";
  const defaultExternalId =
    channel === "INSTAGRAM"
      ? `ig_${organizationId.slice(0, 8)}`
      : `page_${organizationId.slice(0, 8)}`;

  const [created] = await client
    .insert(socialChannelAccount)
    .values({
      organizationId,
      channel,
      provider: "meta",
      externalAccountId: defaultExternalId,
      accountName: defaultName,
      status: "ACTIVE",
      metadata: {
        handle: channel === "INSTAGRAM" ? "anei_academie" : "aneiacademie",
      },
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const [fallback] = await client
    .select()
    .from(socialChannelAccount)
    .where(
      and(
        eq(socialChannelAccount.organizationId, organizationId),
        eq(socialChannelAccount.channel, channel),
      ),
    )
    .limit(1);
  return fallback;
}

export type SocialConversationSummary = {
  peerId: string;
  channel: SocialChannel;
  contactName: string;
  username: string | null;
  avatarUrl: string | null;
  contactId: string | null;
  userId: string | null;
  lastMessage: {
    text: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
  totalMessages: number;
};

export async function getSocialConversations(
  organizationId: string,
  channelFilter?: SocialChannel,
): Promise<SocialConversationSummary[]> {
  const channelCondition = channelFilter
    ? sql`AND channel = ${channelFilter}`
    : sql``;

  const rawThreads = await db.execute<{
    peer_id: string;
    channel: SocialChannel;
    last_activity: Date;
    total_messages: number;
    unread_count: number;
    last_text: string | null;
    last_direction: "INBOUND" | "OUTBOUND";
    last_status: string;
    sender_name: string | null;
    sender_username: string | null;
    sender_avatar_url: string | null;
    contact_id: string | null;
  }>(sql`
    WITH ranked_messages AS (
      SELECT 
        CASE WHEN direction = 'OUTBOUND' THEN recipient_id ELSE sender_id END as peer_id,
        channel,
        text_preview as last_text,
        direction as last_direction,
        status as last_status,
        sender_name,
        sender_username,
        sender_avatar_url,
        contact_id,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN direction = 'OUTBOUND' THEN recipient_id ELSE sender_id END, channel
          ORDER BY created_at DESC, id DESC
        ) as rn
      FROM social_message
      WHERE organization_id = ${organizationId}
        ${channelCondition}
    ),
    thread_summary AS (
      SELECT 
        CASE WHEN direction = 'OUTBOUND' THEN recipient_id ELSE sender_id END as peer_id,
        channel,
        max(created_at) as last_activity,
        count(*)::int as total_messages,
        count(*) FILTER (WHERE direction = 'INBOUND' AND status != 'READ')::int as unread_count
      FROM social_message
      WHERE organization_id = ${organizationId}
        ${channelCondition}
      GROUP BY 1, 2
    )
    SELECT 
      s.peer_id,
      s.channel,
      s.last_activity,
      s.total_messages,
      s.unread_count,
      m.last_text,
      m.last_direction,
      m.last_status,
      m.sender_name,
      m.sender_username,
      m.sender_avatar_url,
      m.contact_id
    FROM thread_summary s
    JOIN ranked_messages m ON (
      m.peer_id = s.peer_id
      AND m.channel = s.channel
      AND m.rn = 1
    )
    ORDER BY s.last_activity DESC
  `);

  return rawThreads.rows.map((row) => ({
    peerId: row.peer_id,
    channel: row.channel,
    contactName:
      row.sender_name ||
      (row.sender_username ? `@${row.sender_username}` : `${row.channel === "INSTAGRAM" ? "Instagram" : "Messenger"} User ${row.peer_id.slice(-4)}`),
    username: row.sender_username ?? null,
    avatarUrl: row.sender_avatar_url ?? null,
    contactId: row.contact_id ?? null,
    userId: null,
    lastMessage: {
      text: row.last_text ?? "",
      direction: row.last_direction,
      status: row.last_status,
      createdAt: new Date(row.last_activity),
    },
    unreadCount: Number(row.unread_count) || 0,
    totalMessages: Number(row.total_messages) || 0,
  }));
}

export async function getSocialConversationMessages(
  organizationId: string,
  channel: SocialChannel,
  peerId: string,
): Promise<SocialMessageRow[]> {
  return db
    .select()
    .from(socialMessage)
    .where(
      and(
        eq(socialMessage.organizationId, organizationId),
        eq(socialMessage.channel, channel),
        or(
          eq(socialMessage.senderId, peerId),
          eq(socialMessage.recipientId, peerId),
        ),
      ),
    )
    .orderBy(asc(socialMessage.createdAt));
}
