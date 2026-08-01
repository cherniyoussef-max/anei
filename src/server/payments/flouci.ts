import { env, flouciConfigured } from "@/server/env";
import type { CheckoutRequest, CheckoutSession, PaymentGateway, VerificationResult } from "./types";
import { PaymentConfigurationError } from "./types";

type GenerateResponse = {
  result?: {
    success?: boolean;
    payment_id?: string;
    link?: string;
    developer_tracking_id?: string;
  };
  code?: number;
  [key: string]: unknown;
};

type VerifyResponse = {
  success?: boolean;
  result?: {
    amount?: number;
    status?: "SUCCESS" | "PENDING" | "EXPIRED" | "FAILURE";
    developer_tracking_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function authorization() {
  if (!flouciConfigured) throw new PaymentConfigurationError("Flouci credentials are not configured.");
  return `Bearer ${env.FLOUCI_PUBLIC_KEY}:${env.FLOUCI_PRIVATE_KEY}`;
}

export const flouciGateway: PaymentGateway = {
  name: "flouci",
  isConfigured: () => flouciConfigured,
  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const successUrl = new URL(`/${request.locale}/paiement/succes`, env.APP_URL);
    successUrl.searchParams.set("order", request.orderId);
    const failUrl = new URL(`/${request.locale}/paiement/echec`, env.APP_URL);
    failUrl.searchParams.set("order", request.orderId);
    const webhookUrl = new URL("/api/payments/flouci/webhook", env.APP_URL);

    const response = await fetch(`${env.FLOUCI_BASE_URL}/api/v2/generate_payment`, {
      method: "POST",
      headers: {
        Authorization: authorization(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(request.amountMillimes),
        developer_tracking_id: request.orderId,
        accept_card: env.FLOUCI_ACCEPT_CARD,
        success_link: successUrl.toString(),
        fail_link: failUrl.toString(),
        webhook: webhookUrl.toString(),
        client_id: request.customerName || request.customerEmail,
        session_timeout_secs: 1200,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json()) as GenerateResponse;
    const paymentId = payload.result?.payment_id;
    const link = payload.result?.link;
    if (!response.ok || !paymentId || !link) {
      throw new Error(`Flouci checkout creation failed (${response.status}).`);
    }

    return {
      provider: "flouci",
      externalPaymentId: paymentId,
      checkoutUrl: link,
      raw: {
        providerCode: payload.code,
        developerTrackingId: payload.result?.developer_tracking_id,
      },
    };
  },
  async verify(externalPaymentId: string): Promise<VerificationResult> {
    const response = await fetch(
      `${env.FLOUCI_BASE_URL}/api/v2/verify_payment/${encodeURIComponent(externalPaymentId)}`,
      {
        headers: { Authorization: authorization() },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload = (await response.json()) as VerifyResponse;
    if (!response.ok || payload.success !== true || !payload.result?.status) {
      throw new Error(`Flouci verification failed (${response.status}).`);
    }

    const map = {
      SUCCESS: "paid",
      PENDING: "pending",
      EXPIRED: "expired",
      FAILURE: "failed",
    } as const;

    return {
      status: map[payload.result.status],
      externalPaymentId,
      amountMillimes: payload.result.amount,
      merchantReference: payload.result.developer_tracking_id,
      raw: {
        providerStatus: payload.result.status,
        amount: payload.result.amount,
        developerTrackingId: payload.result.developer_tracking_id,
      },
    };
  },
};
