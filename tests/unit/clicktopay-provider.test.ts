/**
 * ClickToPay (src/server/payments/clicktopay.ts) is an intentional stub: the
 * merchant-specific SMT/bank integration contract has not been issued yet.
 * These tests document its current, unsupported behavior so nothing
 * accidentally starts treating it as production-capable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { clickToPayGateway } from "../../src/server/payments/clicktopay";
import { PaymentConfigurationError } from "../../src/server/payments/types";

test("ClickToPay reports itself as not configured", () => {
  assert.equal(clickToPayGateway.isConfigured(), false);
});

test("ClickToPay checkout creation is rejected, never silently succeeds", async () => {
  await assert.rejects(
    () =>
      clickToPayGateway.createCheckout({
        orderId: "order-1",
        amountMillimes: 1000,
        currency: "TND",
        customerName: "Test",
        customerEmail: "test@example.test",
        locale: "fr",
      }),
    PaymentConfigurationError,
  );
});

test("ClickToPay verification is rejected, never reports a fabricated status", async () => {
  await assert.rejects(() => clickToPayGateway.verify("any-id"), PaymentConfigurationError);
});
