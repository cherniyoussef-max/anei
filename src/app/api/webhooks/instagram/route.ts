import { NextResponse } from "next/server";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { logger } from "@/server/security/logger";
import { verifyWebhookChallenge, parseAndVerifyMetaWebhook } from "@/server/whatsapp/webhook";
import { instagramVerifyToken, metaAppSecret } from "@/server/social/config";
import { normalizeSocialWebhook } from "@/server/social/normalize";
import { ingestSocialWebhookEvents } from "@/server/services/social-messaging";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = verifyWebhookChallenge(
    {
      mode: url.searchParams.get("hub.mode"),
      verifyToken: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
    },
    instagramVerifyToken,
  );
  if (!ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const challenge = url.searchParams.get("hub.challenge");
  return new NextResponse(challenge ?? "", { status: 200 });
}

export async function POST(request: Request) {
  const rate = await consumeRateLimit(`instagram-webhook-ip:${requestFingerprint(request)}`, 60, 60);
  if (!rate.allowed) {
    logger.warn("instagram.webhook_rate_limited", { scope: "ip" });
    return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const verified = await parseAndVerifyMetaWebhook(request, {
    appSecret: metaAppSecret,
    maxBytes: MAX_WEBHOOK_BODY_BYTES,
  });
  if (!verified.ok) {
    if (verified.status === 500) {
      logger.error("instagram.webhook_misconfigured_secret");
    } else if (verified.status === 413) {
      logger.warn("instagram.webhook_payload_too_large");
    } else if (verified.status === 401) {
      logger.warn("instagram.webhook_signature_invalid");
    } else if (verified.status === 400) {
      logger.warn("instagram.webhook_malformed_payload");
    }
    return NextResponse.json({ ok: false, error: verified.error }, { status: verified.status });
  }

  const events = normalizeSocialWebhook(verified.parsed, "INSTAGRAM");
  if (!events.length) {
    return NextResponse.json({ ok: true });
  }

  const summary = await ingestSocialWebhookEvents(events);
  if (summary.processed > 0) {
    logger.info("instagram.webhook_processed", summary);
  }
  return NextResponse.json({ ok: true });
}
