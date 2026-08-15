import { NextResponse } from "next/server";
import { normalizeWebhook } from "@/server/whatsapp/normalize";
import { verifyWebhookChallenge, verifyWebhookSignature } from "@/server/whatsapp/webhook";
import { whatsappAppSecret, whatsappVerifyToken } from "@/server/whatsapp/config";
import { readLimitedRawBody } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { logger } from "@/server/security/logger";
import { ingestWebhookEvents } from "@/server/services/whatsapp-webhook";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

/**
 * Official Meta WhatsApp Cloud API webhook receiver.
 *
 * - GET: the Meta verification handshake (hub.mode/hub.verify_token/hub.challenge).
 *   Responds 200 with the raw challenge only when mode is `subscribe` and the
 *   token matches; anything else fails closed.
 * - POST: every delivery is verified via `X-Hub-Signature-256` (HMAC-SHA256 of
 *   the RAW body keyed with the Meta app secret) BEFORE parsing. Signature
 *   verification must run over the exact received bytes — never a parsed and
 *   re-serialized body — so the raw body is read to a bounded byte ceiling and
 *   the same bytes feed both the signature check and the JSON parse.
 *
 * Unknown events are ignored (counted, not failed): Meta may deliver events
 * for numbers configured in another deployment, and Meta retries non-2xx.
 * We return 200 as soon as events are durably ledgered (dedup + side effects
 * in one transaction), so replays are idempotent at the DB level.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = verifyWebhookChallenge(
    {
      mode: url.searchParams.get("hub.mode"),
      verifyToken: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
    },
    whatsappVerifyToken,
  );
  if (!ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const challenge = url.searchParams.get("hub.challenge");
  return new NextResponse(challenge ?? "", { status: 200 });
}

export async function POST(request: Request) {
  const rate = await consumeRateLimit(`whatsapp-webhook-ip:${requestFingerprint(request)}`, 60, 60);
  if (!rate.allowed) {
    logger.warn("whatsapp.webhook_rate_limited", { scope: "ip" });
    return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const raw = await readLimitedRawBody(request, MAX_WEBHOOK_BODY_BYTES).catch(() => null);
  if (!raw) return NextResponse.json({ ok: false }, { status: 413 });

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const verified = verifyWebhookSignature(raw, signatureHeader, whatsappAppSecret);
  if (!verified) {
    logger.warn("whatsapp.webhook_signature_invalid");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    logger.warn("whatsapp.webhook_malformed_payload");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const events = normalizeWebhook(parsed);
  if (!events.length) {
    // Object is not "whatsapp_business_account" or carries no recognizable
    // messages/statuses — acknowledge to stop Meta retrying the handshake echo.
    return NextResponse.json({ ok: true });
  }

  const summary = await ingestWebhookEvents(events);
  if (summary.processed > 0) {
    logger.info("whatsapp.webhook_processed", summary);
  }
  return NextResponse.json({ ok: true });
}