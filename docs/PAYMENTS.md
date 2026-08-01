# Payments

`PaymentGateway` isolates provider APIs from order/entitlement business logic.

## Invariant
A browser never decides authoritative amount, currency or entitlement. The server loads the sellable item, creates a local order, creates provider checkout, verifies provider result server-to-server, checks amount/currency/transaction identity, then transactionally commits paid state + entitlement + notification/audit.

## Providers
- **mock:** development only, explicit confirmation POST; forbidden in production.
- **Flouci:** enabled only with verified credentials/configuration.
- **ClicToPay:** adapter remains fail-closed until official merchant technical details are supplied.

## Operations
Reconcile provider transactions with local orders regularly. Alert on payment verification failures, amount mismatches and repeated webhook errors.
