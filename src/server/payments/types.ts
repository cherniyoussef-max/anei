export type PaymentProvider = "mock" | "flouci" | "clicktopay";

export type CheckoutRequest = {
  orderId: string;
  amountMillimes: number;
  currency: "TND";
  customerName: string;
  customerEmail: string;
  locale: "fr" | "ar";
};

export type CheckoutSession = {
  provider: PaymentProvider;
  externalPaymentId: string | null;
  checkoutUrl: string;
  raw?: Record<string, unknown>;
};

export type VerificationResult = {
  status: "paid" | "pending" | "failed" | "expired";
  externalPaymentId?: string;
  amountMillimes?: number;
  merchantReference?: string;
  raw?: Record<string, unknown>;
};

export interface PaymentGateway {
  readonly name: PaymentProvider;
  isConfigured(): boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  verify(externalPaymentId: string): Promise<VerificationResult>;
}

export class PaymentConfigurationError extends Error {}
