# Google authentication setup

ANEI uses Better Auth's native Google provider and One Tap plugin. It does not
implement Google's OAuth token exchange itself.

## Development origin

Normal `npm run dev` development uses:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

The standalone local-production smoke command (`npm run start:local`) binds to
`127.0.0.1` but keeps the browser/OAuth origin canonical and consistent with `.env`:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Google compares redirect URIs exactly. Open the application through `localhost`
so the browser origin and `BETTER_AUTH_URL` remain identical.

## Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select the project used for ANEI.
3. Open **Google Auth Platform** and configure the OAuth consent screen.
4. Set the app name and support/developer contacts, then configure the audience
   and test users. Request only `openid`, `email`, and `profile`.
5. Open **Clients**, choose **Create client**, and select **Web application**.
6. Add the exact ANEI origin under **Authorized JavaScript origins**. One Tap
   requires this entry.
7. Add the matching `/api/auth/callback/google` URL under
   **Authorized redirect URIs**.
8. Copy the Client ID.
9. Copy the Client Secret into the deployment secret manager; do not commit it.
10. Set:

    ```env
    ENABLE_GOOGLE_AUTH=true
    GOOGLE_CLIENT_ID=your-web-client-id
    GOOGLE_CLIENT_SECRET=your-web-client-secret
    ```

11. Ensure `BETTER_AUTH_URL`, `APP_URL`, and `TRUSTED_ORIGINS` use the same
    canonical origin, then restart ANEI.
12. Test French and Arabic login, cancellation, a new Google user, an existing
    Google user, and a verified existing password account.

## Production

Production must use HTTPS. For `https://academy.example.tn`, configure:

- Authorized JavaScript origin: `https://academy.example.tn`
- Authorized redirect URI:
  `https://academy.example.tn/api/auth/callback/google`
- `APP_URL=https://academy.example.tn`
- `BETTER_AUTH_URL=https://academy.example.tn`
- `TRUSTED_ORIGINS=https://academy.example.tn`

Replace the example domain with the deployed canonical domain. Do not add
wildcards, arbitrary preview origins, or a localhost redirect to production
configuration.

## Account and role behavior

- A new Google or One Tap account is created with role `USER`.
- Google attributes never grant `ADMIN` or `SUPER_ADMIN`.
- Better Auth may implicitly link a matching Google identity only when Google
  verifies the email and the existing local account is already verified.
- Different-email linking and unlinking the final login method are disabled.
- Existing roles remain server-side database state after a safe link.
- OAuth token fields managed by Better Auth are encrypted at rest.

If Google is disabled or either credential is absent, ANEI still boots and
email/password authentication remains available. In production, setting
`ENABLE_GOOGLE_AUTH=true` with incomplete credentials fails startup explicitly.

## Troubleshooting

- `redirect_uri_mismatch`: compare the full Google redirect URI with
  `BETTER_AUTH_URL + /api/auth/callback/google`, including host and scheme.
- One Tap does not appear: verify the JavaScript origin, browser/FedCM support,
  content-security policy, and that the prompt was not dismissed in this browser
  session. The normal Google button remains the fallback.
- Account cannot be linked: sign in using the existing method, verify that
  account's email, and link Google from account settings. Never merge accounts
  based on an unverified identifier.
