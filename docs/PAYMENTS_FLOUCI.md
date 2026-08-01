# Flouci integration

The adapter must be checked against current official Flouci documentation before every production rollout. Merchant public/private credentials remain server-side.

Required deployment work:
1. obtain sandbox merchant credentials;
2. enable `ENABLE_FLOUCI` only in staging first;
3. verify checkout redirect and server-side payment verification;
4. test failed/expired/duplicate callbacks;
5. compare returned amount/currency to the local order;
6. verify idempotent entitlement grant;
7. obtain production credentials and switch only after acceptance tests.

Never grant access because a return URL contains a success flag. The provider verification result and local transaction are authoritative.
