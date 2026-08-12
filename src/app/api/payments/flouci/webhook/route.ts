import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAndApplyByExternalId } from "@/server/services/checkout";
import { logger } from "@/server/security/logger";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";

/**
 * Flouci's own docs (docs.flouci.com / flouci.stoplight.io, checked at
 * implementation time) document the `webhook` field only as "the webhook URL
 * you want to receive payment confirmation on" — no signature, HMAC, shared
 * secret, callback token, IP allowlist, or event-id scheme is published, and
 * no retry semantics are documented. There is nothing to verify the caller
 * with, so this handler intentionally does not invent a homemade signature
 * check. The only trust boundary is the mandatory server-to-server re-verify
 * in verifyAndApplyByExternalId(); the payload below is treated purely as a
 * hint of *which* payment to re-check, never as proof of its status.
 */
const idField = z.string().trim().min(1).max(128);
const payloadSchema = z
  .object({
    payment_id: idField.optional(),
    paymentId: idField.optional(),
    result: z.object({ payment_id: idField.optional() }).partial().optional(),
  })
  .passthrough(); // Flouci's exact field set beyond payment_id is undocumented; unknown fields are ignored, never trusted.

function paymentIdFrom(payload: z.infer<typeof payloadSchema>) {
  return payload.payment_id ?? payload.paymentId ?? payload.result?.payment_id ?? null;
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) return NextResponse.json({ ok: false }, { status: 413 });

  const ipRate = await consumeRateLimit(`flouci-webhook-ip:${requestFingerprint(request)}`, 30, 60);
  if (!ipRate.allowed) {
    logger.warn("payment.flouci_webhook_rate_limited", { scope: "ip" });
    return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSeconds) } });
  }

  const raw = await readLimitedJson(request, 64 * 1024).catch(() => null);
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn("payment.flouci_webhook_malformed_payload");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const paymentId = paymentIdFrom(parsed.data);
  if (!paymentId) {
    logger.warn("payment.flouci_webhook_missing_payment_id");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // A second, tighter limit keyed on the specific payment identifier: this is
  // the actual abuse this hardens against — an attacker (or a stuck retry
  // loop) hammering re-verification for one known payment_id, potentially
  // from many different source IPs/shared provider infrastructure, which the
  // coarse IP limit above would not catch. The key is a fixed-length hash of
  // an already length-bounded (<=128 char) identifier, so a flood of distinct
  // garbage ids cannot grow Redis memory beyond what the IP limit already caps,
  // and every key expires with the rate-limit window regardless.
  const paymentKey = crypto.createHash("sha256").update(paymentId).digest("hex").slice(0, 32);
  const paymentRate = await consumeRateLimit(`flouci-webhook-payment:${paymentKey}`, 5, 60);
  if (!paymentRate.allowed) {
    logger.warn("payment.flouci_webhook_rate_limited", { scope: "payment", paymentKey });
    return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(paymentRate.retryAfterSeconds) } });
  }

  try {
    // Never trust webhook payload as proof of payment; re-check directly with Flouci.
    // verifyAndApplyByExternalId looks the payment up by (provider, externalPaymentId)
    // first and throws before any outbound Flouci call if it doesn't exist, so an
    // unknown/guessed payment_id never reaches the provider API.
    await verifyAndApplyByExternalId("flouci", paymentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "PAYMENT_NOT_FOUND") {
      // Not a system fault: a permanently unknown reference should read as
      // non-retryable (4xx), not as a transient server error a sender might
      // legitimately keep retrying forever.
      logger.warn("payment.flouci_webhook_unknown_payment", { paymentKey });
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    logger.error("payment.flouci_webhook_verification_failed", { paymentKey, error: message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
