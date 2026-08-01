# Authentication

ANEI uses Better Auth. Email/password is the baseline; Google OAuth is explicitly feature-flagged.

## Supported flows
- sign up / sign in / sign out;
- email verification;
- forgot/reset password;
- password change for credential accounts;
- optional Google OAuth;
- optional Google One Tap (progressive enhancement);
- connected-provider display;
- active session list;
- revoke one session or all other sessions;
- privacy-safe account data export.

Google-only users are not shown a credential-password form that cannot work.

## Production requirements
- strong random `BETTER_AUTH_SECRET` (project policy: at least 48 characters in production);
- HTTPS `APP_URL` and `BETTER_AUTH_URL`;
- exact `TRUSTED_ORIGINS` only;
- secure/HttpOnly/SameSite cookie behavior from Better Auth production configuration;
- Better Auth CSRF/origin protections remain enabled;
- account/auth endpoints retain framework/provider protections; custom ANEI mutations have their own same-origin guard too;
- email verification is required by production config;
- Redis/database rate limits and monitoring for abuse.

The session cookie-cache window is intentionally short (60 seconds) so explicit remote-session revocation is reflected quickly. Session revocation remains a server operation; never treat the client UI as authorization.

## Google
Set:
```env
ENABLE_GOOGLE_AUTH=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```
Register the exact production callback, for example:
`https://academy.example.tn/api/auth/callback/google`.

For local development, the callback host must exactly match `BETTER_AUTH_URL`:
- `http://localhost:3000/api/auth/callback/google` when using `localhost`;
- `http://127.0.0.1:3000/api/auth/callback/google` when intentionally using `127.0.0.1`.

Do not register one host and start the sign-in flow from the other. In Google Cloud Console,
create an OAuth 2.0 Web application, add the exact authorized redirect URI above, and add
the application origin under authorized JavaScript origins. The provider remains hidden
when `ENABLE_GOOGLE_AUTH`, `GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_SECRET` is absent.

See `docs/GOOGLE_AUTH_SETUP.md` for the exact Console steps and both canonical
local-origin modes.

Never expose `GOOGLE_CLIENT_SECRET` through browser code or `NEXT_PUBLIC_*` variables. Use only trusted relative application redirects after authentication.

New users are forced to `USER` by a database creation hook. Better Auth's
account-linking policy permits implicit same-email linking only when the Google
identity and the existing local account are verified. Different-email linking is
disabled, OAuth token fields are encrypted at rest, and Google never assigns an
ANEI administrative role.

## Password reset / verification email
Tokens are generated/validated by Better Auth. The mailer does not log reset/verification URLs. Production refuses localhost SMTP while email verification is mandatory.

## Privileged accounts and MFA
`ENABLE_ADMIN_MFA` is a fail-closed rollout flag. It must remain false until a supported Better Auth 2FA mechanism, enrollment/recovery UX, admin policy and regression tests are implemented. Do not build custom OTP/cryptographic primitives.
