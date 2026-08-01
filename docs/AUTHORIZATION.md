# Authorization

## Roles
- `USER`: own dashboard, enrollments, entitled learning/resources, own webinar registrations and account-security actions.
- `ADMIN`: operational academy content/support/commerce actions exposed by admin server routes.
- `SUPER_ADMIN`: privileged role management and sensitive operations reserved by policy.

## Mandatory rule
Client UI is never an authorization boundary. Every protected server route/service resolves actor identity from the authenticated session and independently validates role plus ownership/entitlement. IDs, roles, prices and completion values from the browser are untrusted.

## Key boundaries
| Resource/action | Required server evidence |
|---|---|
| learner dashboard/profile/export/sessions | authenticated same user/session |
| enrolled course learning/media | authenticated user + enrollment for requested course |
| purchased resource download | authenticated user + purchase matching requested resource |
| webinar protected access | authenticated user + registration/entitlement when required |
| admin content mutation | ADMIN or SUPER_ADMIN session + mutation protections |
| role assignment | SUPER_ADMIN session; cannot rely on body role; final-super-admin safety applies |
| payment reconciliation | admin role + existing order + paid state or successful provider re-verification |

## IDOR/BOLA regression requirements
- USER A cannot obtain USER B data by substituting user/resource/order/session/certificate identifiers.
- anonymous callers cannot access learner/admin protected endpoints.
- ADMIN cannot perform SUPER_ADMIN-only role changes.
- protected object storage URLs are created only after authorization, not stored as permanent public URLs.
- adding a new identifier-based endpoint requires an ownership/role test before completion.
