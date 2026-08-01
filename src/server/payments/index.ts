import { clickToPayGateway } from "./clicktopay";
import { flouciGateway } from "./flouci";
import { mockGateway } from "./mock";
import type { PaymentGateway, PaymentProvider } from "./types";

const gateways: Record<PaymentProvider, PaymentGateway> = {
  mock: mockGateway,
  flouci: flouciGateway,
  clicktopay: clickToPayGateway,
};

export function getPaymentGateway(provider: PaymentProvider) {
  return gateways[provider];
}

export function getPaymentCapabilities() {
  return (Object.keys(gateways) as PaymentProvider[]).map((provider) => ({
    provider,
    configured: gateways[provider].isConfigured(),
  }));
}
