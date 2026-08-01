# Admin operations

## Roles
- `USER`: learner/customer capabilities only.
- `ADMIN`: operational academy content/support/commerce management allowed by server routes.
- `SUPER_ADMIN`: privileged role assignment and sensitive administrative actions.

The server session is the source of actor identity/role. Client controls are convenience only.

## Current admin areas
- dashboard/content operations: courses, modules, lessons, webinars, resources, AVS, news and contacts;
- `/admin/utilisateurs`: paginated/searchable user management;
- `/admin/commandes`: paginated/searchable order/payment operations and safe reconciliation;
- `/admin/audit`: paginated audit history.

## Payment reconciliation rule
Reconciliation may repair an entitlement only when the order is already paid or the external provider can be re-verified as paid. It must never be used as a manual “mark paid” shortcut.

## Role safety
SUPER_ADMIN role mutation rejects self-demotion and protects the final super-admin using a transaction/advisory lock. Keep at least two controlled privileged accounts in a real operational environment after MFA/recovery procedures exist.
