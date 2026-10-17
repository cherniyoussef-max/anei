import { NextResponse } from "next/server";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { logger } from "@/server/security/logger";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  MAX_META_WEBHOOK_BODY_BYTES,
} from "@/server/whatsapp/webhook";
import { readLimitedRawBody } from "@/server/security/request-body";
import {
  metaAppSecret,
  messengerVerifyToken,
} from "@/server/social/config";
import { whatsappVerifyToken } from "@/server/whatsapp/config";
import {
  ingestOmnichannelMessage,
  updateOmnichannelMessageStatus,
  type MetaAdReferralPayload,
} from "@/server/services/omnichannel-crm";

interface MetaMessagingItem {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; referral?: MetaAdReferralPayload };
  referral?: MetaAdReferralPayload;
  read?: { mid?: string };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verifyToken =
    process.env.META_VERIFY_TOKEN?.trim() ||
    whatsappVerifyToken ||
    messengerVerifyToken;

  const ok = verifyWebhookChallenge(
    {
      mode: url.searchParams.get("hub.mode"),
      verifyToken: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
    },
    verifyToken
  );

  if (!ok) {
    logger.warn("meta.webhook_challenge_failed");
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const challenge = url.searchParams.get("hub.challenge");
  return new NextResponse(challenge ?? "", { status: 200 });
}

export async function POST(request: Request) {
  const rate = await consumeRateLimit(
    `meta-webhook-ip:${requestFingerprint(request)}`,
    120,
    60
  );
  if (!rate.allowed) {
    logger.warn("meta.webhook_rate_limited", { scope: "ip" });
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const secret = metaAppSecret;
  if (!secret) {
    logger.error("meta.webhook_misconfigured_secret");
    return NextResponse.json(
      { ok: false, error: "MISCONFIGURED" },
      { status: 500 }
    );
  }

  const raw = await readLimitedRawBody(request, MAX_META_WEBHOOK_BODY_BYTES).catch(
    () => null
  );
  if (!raw) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const verified = verifyWebhookSignature(raw, signatureHeader, secret);
  if (!verified) {
    logger.warn("meta.webhook_signature_invalid");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    logger.warn("meta.webhook_malformed_payload");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const objectType = typeof parsed?.object === "string" ? parsed.object : undefined;
  const entries = Array.isArray(parsed?.entry) ? (parsed.entry as Array<Record<string, unknown>>) : [];

  try {
    // 1. WhatsApp Cloud API Webhook
    if (objectType === "whatsapp_business_account") {
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? (entry.changes as Array<Record<string, unknown>>) : [];
        for (const change of changes) {
          if (change.field !== "messages" || !change.value || typeof change.value !== "object") continue;
          const val = change.value as Record<string, unknown>;
          const messages = Array.isArray(val.messages) ? (val.messages as Array<Record<string, unknown>>) : [];
          const statuses = Array.isArray(val.statuses) ? (val.statuses as Array<Record<string, unknown>>) : [];
          const contacts = Array.isArray(val.contacts) ? (val.contacts as Array<{ wa_id?: string; profile?: { name?: string } }>) : [];

          // Process Inbound Messages
          for (const msg of messages) {
            const msgId = typeof msg.id === "string" ? msg.id : undefined;
            const from = typeof msg.from === "string" ? msg.from : undefined;
            if (!msgId || !from) continue;
            const textBody = msg.text && typeof msg.text === "object" ? (msg.text as Record<string, unknown>).body : undefined;
            const textContent =
              (typeof textBody === "string" ? textBody : null) ||
              `[${String(msg.type ?? "message")}]`;

            const contactProfile = contacts.find((c) => c.wa_id === from);
            const contactName = contactProfile?.profile?.name || from;

            await ingestOmnichannelMessage({
              channel: "WHATSAPP",
              externalContactId: from,
              contactName,
              direction: "INBOUND",
              content: textContent,
              messageType: msg.type === "template" ? "TEMPLATE" : "TEXT",
              metaMessageId: msgId,
              deliveryStatus: "DELIVERED",
              referral: (msg.referral as MetaAdReferralPayload) ?? null,
            });
          }

          // Process Delivery / Read Status Updates
          for (const status of statuses) {
            const statusId = typeof status.id === "string" ? status.id : undefined;
            const statusVal = typeof status.status === "string" ? status.status : undefined;
            if (!statusId || !statusVal) continue;
            const mappedStatus = statusVal.toUpperCase();
            if (
              mappedStatus === "DELIVERED" ||
              mappedStatus === "READ" ||
              mappedStatus === "FAILED"
            ) {
              await updateOmnichannelMessageStatus(statusId, mappedStatus);
            }
          }
        }
      }
    }

    // 2. Instagram Direct Webhook
    else if (objectType === "instagram") {
      for (const entry of entries) {
        const messagingList = Array.isArray(entry.messaging) ? (entry.messaging as MetaMessagingItem[]) : [];
        for (const messaging of messagingList) {
          const senderId = typeof messaging.sender?.id === "string" ? messaging.sender.id : undefined;
          if (!senderId) continue;

          // Message Received
          if (messaging.message) {
            const content = typeof messaging.message.text === "string" ? messaging.message.text : "[Media attachment]";
            const referral = messaging.referral || messaging.message.referral || null;

            await ingestOmnichannelMessage({
              channel: "INSTAGRAM",
              externalContactId: senderId,
              contactName: `Instagram @${senderId.slice(-6)}`,
              direction: "INBOUND",
              content,
              messageType: "TEXT",
              metaMessageId: typeof messaging.message.mid === "string" ? messaging.message.mid : undefined,
              deliveryStatus: "DELIVERED",
              referral,
            });
          }

          // Message Status (Read / Delivery)
          if (messaging.read && typeof messaging.read.mid === "string") {
            await updateOmnichannelMessageStatus(messaging.read.mid, "READ");
          }
        }
      }
    }

    // 3. Facebook Messenger Webhook
    else if (objectType === "page") {
      for (const entry of entries) {
        const messagingList = Array.isArray(entry.messaging) ? (entry.messaging as MetaMessagingItem[]) : [];
        for (const messaging of messagingList) {
          const senderId = typeof messaging.sender?.id === "string" ? messaging.sender.id : undefined;
          if (!senderId) continue;

          // Message Received
          if (messaging.message) {
            const content = typeof messaging.message.text === "string" ? messaging.message.text : "[Media attachment]";
            const referral = messaging.referral || messaging.message.referral || null;

            await ingestOmnichannelMessage({
              channel: "MESSENGER",
              externalContactId: senderId,
              contactName: `Messenger User #${senderId.slice(-6)}`,
              direction: "INBOUND",
              content,
              messageType: "TEXT",
              metaMessageId: typeof messaging.message.mid === "string" ? messaging.message.mid : undefined,
              deliveryStatus: "DELIVERED",
              referral,
            });
          }

          // Message Status
          if (messaging.read && typeof messaging.read.mid === "string") {
            await updateOmnichannelMessageStatus(messaging.read.mid, "READ");
          }
        }
      }
    }
  } catch (err) {
    logger.error("meta.webhook_processing_error", { error: String(err) });
  }

  return NextResponse.json({ ok: true });
}
