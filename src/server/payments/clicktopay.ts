import type { CheckoutSession, PaymentGateway, VerificationResult } from "./types";
import { PaymentConfigurationError } from "./types";

/**
 * ClickToPay/SMT merchant integrations are contract-specific: the exact merchant
 * endpoint, signing fields and response mapping are issued during merchant onboarding.
 * We expose the provider in the architecture, but intentionally do not guess a banking
 * protocol. Once the acquiring-bank/SMT integration document is available, only this
 * adapter needs to be implemented; checkout and entitlement logic stays unchanged.
 */
export const clickToPayGateway: PaymentGateway = {
  name: "clicktopay",
  isConfigured: () => false,
  async createCheckout(): Promise<CheckoutSession> {
    throw new PaymentConfigurationError(
      "ClickToPay connector requires the merchant-specific SMT/bank integration contract before activation.",
    );
  },
  async verify(): Promise<VerificationResult> {
    throw new PaymentConfigurationError(
      "ClickToPay verification mapping is not activated until the merchant contract is configured.",
    );
  },
};
