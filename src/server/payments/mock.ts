import crypto from "node:crypto";
import { env } from "@/server/env";
import type { CheckoutRequest, CheckoutSession, PaymentGateway, VerificationResult } from "./types";

export function createMockToken(orderId: string) {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(orderId).digest("hex");
}

export function verifyMockToken(orderId: string, token: string) {
  const expected = createMockToken(orderId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const mockGateway: PaymentGateway = {
  name: "mock",
  isConfigured: () => env.NODE_ENV !== "production" || env.PAYMENT_ALLOW_MOCK,
  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const token = createMockToken(request.orderId);
    const url = new URL(`/${request.locale}/paiement/mock`, env.APP_URL);
    url.searchParams.set("order", request.orderId);
    url.searchParams.set("token", token);
    url.searchParams.set("locale", request.locale);
    return {
      provider: "mock",
      externalPaymentId: `mock_${request.orderId}`,
      checkoutUrl: url.toString(),
      raw: { mode: "local-demo" },
    };
  },
  async verify(): Promise<VerificationResult> {
    return { status: "pending" };
  },
};
