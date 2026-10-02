export type SocialChannel = "INSTAGRAM" | "MESSENGER";

export type NormalizedSocialInboundMessage = {
  kind: "inbound_message";
  channel: SocialChannel;
  stableKey: string;
  providerMessageId: string;
  senderId: string;
  recipientId: string;
  senderName?: string;
  senderUsername?: string;
  senderAvatarUrl?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: "IMAGE" | "AUDIO" | "FILE" | "VIDEO";
  timestamp: Date;
  externalAccountId: string;
};

export type NormalizedSocialStatusUpdate = {
  kind: "status_update";
  channel: SocialChannel;
  stableKey: string;
  providerMessageId: string;
  status: "DELIVERED" | "READ";
  timestamp: Date;
  externalAccountId: string;
};

export type NormalizedSocialEvent =
  | NormalizedSocialInboundMessage
  | NormalizedSocialStatusUpdate;

export function socialWebhookStableKey(
  channel: SocialChannel,
  kind: "message" | "status",
  providerMessageId: string,
  extra?: string,
): string {
  return extra
    ? `social:${channel.toLowerCase()}:${kind}:${providerMessageId}:${extra}`
    : `social:${channel.toLowerCase()}:${kind}:${providerMessageId}`;
}

export function normalizeSocialWebhook(
  raw: unknown,
  channelHint?: SocialChannel,
): NormalizedSocialEvent[] {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as { object?: string; entry?: unknown[] };

  let channel: SocialChannel = "MESSENGER";
  if (payload.object === "instagram" || channelHint === "INSTAGRAM") {
    channel = "INSTAGRAM";
  } else if (payload.object === "page" || channelHint === "MESSENGER") {
    channel = "MESSENGER";
  }

  if (!Array.isArray(payload.entry)) return [];

  const events: NormalizedSocialEvent[] = [];

  for (const entry of payload.entry) {
    if (!entry || typeof entry !== "object") continue;
    const entryObj = entry as { id?: string; messaging?: unknown[] };
    const externalAccountId = typeof entryObj.id === "string" ? entryObj.id : "default";

    if (!Array.isArray(entryObj.messaging)) continue;

    for (const msgItem of entryObj.messaging) {
      if (!msgItem || typeof msgItem !== "object") continue;
      const m = msgItem as {
        sender?: { id?: string };
        recipient?: { id?: string };
        timestamp?: number;
        message?: {
          mid?: string;
          text?: string;
          is_echo?: boolean;
          attachments?: Array<{
            type?: string;
            payload?: { url?: string };
          }>;
        };
        delivery?: {
          mids?: string[];
          watermark?: number;
        };
        read?: {
          mids?: string[];
          watermark?: number;
        };
      };

      const senderId = m.sender?.id ? String(m.sender.id).trim().slice(0, 128) : "";
      const recipientId = m.recipient?.id ? String(m.recipient.id).trim().slice(0, 128) : "";
      const ts = typeof m.timestamp === "number" ? new Date(m.timestamp) : new Date();

      // Inbound message
      if (m.message && typeof m.message === "object") {
        // Echoes are outbound messages sent by the page; we ignore them here
        if (m.message.is_echo) continue;

        const mid = m.message.mid ? String(m.message.mid).trim().slice(0, 255) : null;
        if (!mid || !senderId || !recipientId) continue;

        let mediaUrl: string | undefined;
        let mediaType: "IMAGE" | "AUDIO" | "FILE" | "VIDEO" | undefined;

        if (Array.isArray(m.message.attachments) && m.message.attachments.length > 0) {
          const firstAtt = m.message.attachments[0];
          if (firstAtt.payload?.url) {
            mediaUrl = String(firstAtt.payload.url).slice(0, 1024);
          }
          if (firstAtt.type === "image") mediaType = "IMAGE";
          else if (firstAtt.type === "audio") mediaType = "AUDIO";
          else if (firstAtt.type === "video") mediaType = "VIDEO";
          else if (firstAtt.type === "file") mediaType = "FILE";
        }

        const text = typeof m.message.text === "string" ? m.message.text.slice(0, 4000) : "";

        events.push({
          kind: "inbound_message",
          channel,
          stableKey: socialWebhookStableKey(channel, "message", mid),
          providerMessageId: mid,
          senderId,
          recipientId,
          text,
          mediaUrl,
          mediaType,
          timestamp: ts,
          externalAccountId,
        });
      }

      // Delivery receipt
      if (m.delivery?.mids && Array.isArray(m.delivery.mids)) {
        for (const mid of m.delivery.mids) {
          if (!mid || typeof mid !== "string") continue;
          const cleanMid = mid.trim().slice(0, 255);
          events.push({
            kind: "status_update",
            channel,
            stableKey: socialWebhookStableKey(channel, "status", cleanMid, "DELIVERED"),
            providerMessageId: cleanMid,
            status: "DELIVERED",
            timestamp: ts,
            externalAccountId,
          });
        }
      }

      // Read receipt
      if (m.read?.mids && Array.isArray(m.read.mids)) {
        for (const mid of m.read.mids) {
          if (!mid || typeof mid !== "string") continue;
          const cleanMid = mid.trim().slice(0, 255);
          events.push({
            kind: "status_update",
            channel,
            stableKey: socialWebhookStableKey(channel, "status", cleanMid, "READ"),
            providerMessageId: cleanMid,
            status: "READ",
            timestamp: ts,
            externalAccountId,
          });
        }
      }
    }
  }

  return events;
}
