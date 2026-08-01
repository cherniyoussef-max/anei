import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { createOrderCheckout, hasEntitlement } from "@/server/services/checkout";
import { env } from "@/server/env";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const bodySchema = z.object({
  itemType: z.enum(["course", "resource"]),
  itemId: z.string().uuid(),
  provider: z.enum(["mock", "flouci", "clicktopay"]).optional(),
  locale: z.enum(["fr", "ar"]).default("fr"),
  idempotencyKey: z.string().min(12).max(160).optional(),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`checkout:${session.user.id}`, 20, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  const idempotencyKey = parsed.data.idempotencyKey ?? request.headers.get("Idempotency-Key") ?? `${session.user.id}:${parsed.data.itemType}:${parsed.data.itemId}:${crypto.randomUUID()}`;
  try {
    if (await hasEntitlement(session.user.id, parsed.data.itemType, parsed.data.itemId)) {
      return NextResponse.json({ status: "owned", checkoutUrl: `/${parsed.data.locale}/dashboard`, provider: "existing" });
    }
    const result = await createOrderCheckout({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      locale: parsed.data.locale,
      itemType: parsed.data.itemType,
      itemId: parsed.data.itemId,
      provider: parsed.data.provider ?? env.PAYMENT_DEFAULT_PROVIDER,
      idempotencyKey,
    });
    return NextResponse.json({
      orderId: result.order.id,
      status: result.order.status,
      checkoutUrl: result.payment?.checkoutUrl ?? `/${parsed.data.locale}/dashboard`,
      provider: result.order.provider,
      reused: result.reused,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CHECKOUT_FAILED";
    const status = message === "ITEM_NOT_FOUND" ? 404 : message === "PAYMENT_PROVIDER_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
