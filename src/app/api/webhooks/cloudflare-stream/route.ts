import { NextResponse } from "next/server";
import { verifyStreamWebhookSignature, syncVideoAssetStatus } from "@/server/media/cloudflare-stream";
import { logger } from "@/server/security/logger";

const noStore = { "Cache-Control": "private, no-store" } as const;

export async function POST(request: Request) {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST_BODY" }, { status: 400, headers: noStore });
  }

  const signature = request.headers.get("Webhook-Signature") || request.headers.get("webhook-signature");

  // In production or when secret is configured, strictly verify the webhook signature
  if (process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET) {
    const isValid = verifyStreamWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn("cloudflare_stream_webhook.invalid_signature", { signature });
      return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401, headers: noStore });
    }
  }

  let event: Record<string, unknown> = {};
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore });
  }

  const uid =
    (typeof event.uid === "string" ? event.uid : null) ||
    (typeof event.videoUid === "string" ? event.videoUid : null) ||
    (event.data && typeof (event.data as Record<string, unknown>).uid === "string"
      ? ((event.data as Record<string, unknown>).uid as string)
      : null);

  if (!uid) {
    // Acknowledge webhook even if event has no uid
    return NextResponse.json({ received: true, ignored: true }, { status: 200, headers: noStore });
  }

  try {
    await syncVideoAssetStatus({ cloudflareUid: uid });
    logger.info("cloudflare_stream_webhook.video_synced", { uid });
    return NextResponse.json({ success: true, uid }, { status: 200, headers: noStore });
  } catch (err) {
    logger.error("cloudflare_stream_webhook.sync_failed", { uid, error: String(err) });
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500, headers: noStore });
  }
}
