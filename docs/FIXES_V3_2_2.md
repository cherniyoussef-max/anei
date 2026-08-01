# ANEI v3.2.2 build/runtime environment fix

Next.js evaluates server modules during `next build`. v3.2.1 applied deployment-only production guards during that build evaluation, so a normal local artifact build required real production DATABASE_URL, HTTPS origins, SMTP, payments, and S3 settings.

## Fix

- `npm run build` uses an internal build-phase marker and still performs schema/type validation, but defers deployment-only requirements until runtime.
- `npm run start` remains strict and fail-closed for real production.
- `npm run start:local` enables a loopback-only smoke mode. It refuses non-loopback APP_URL, BETTER_AUTH_URL, DATABASE_URL, or trusted origins.

Use:

```bash
npm run build
npm run start:local
```

Real deployment remains:

```bash
npm run build
npm run start
```

with the complete production environment configured.
