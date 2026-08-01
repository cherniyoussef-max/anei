# ANEI v3.2.4 local production auth fix

This patch fixes the local standalone smoke server reporting `Invalid origin: http://127.0.0.1:3000`.

## Root cause

The standalone server bound to `127.0.0.1`, while the local `.env` commonly used `http://localhost:3000` for Better Auth and trusted origins. The explicit production cookie setting also forced Secure cookies during the local HTTP smoke test.

## Fix

`npm run start:local` now derives the local origin from `PORT` (default 3000), sets APP_URL/BETTER_AUTH_URL/TRUSTED_ORIGINS consistently to that loopback origin, then imports the generated standalone server. Better Auth only disables Secure cookies in the guarded `ANEI_LOCAL_PRODUCTION=1` loopback mode. Real production behavior remains strict.

## Usage

```bash
npm run build
npm run start:local
```

Optional port:

```bash
PORT=3001 npm run start:local
```
