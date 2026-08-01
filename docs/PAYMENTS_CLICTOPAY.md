# ClicToPay

ClicToPay is intentionally **not fabricated**. Real integration requires the official merchant/acquiring-bank/SMT technical contract, credentials, endpoints, signatures/verification fields, notification URLs and certification/test process.

Until those are supplied:
- keep `ENABLE_CLICTOPAY=false`;
- the adapter must fail closed;
- do not display it as a working production method;
- never infer request/signature formats from unofficial examples.

When documentation is available, implement it behind the existing `PaymentGateway` contract and reuse local order, verification, idempotency, transaction and entitlement logic.
