# ANEI v3.2.3 standalone runtime fix

v3.2.2 successfully separated build-time and deployment-time environment validation, but two follow-up issues remained:

1. the build/local-start helper scripts used process spawning and were correctly rejected by the repository security audit;
2. `start:local` invoked `next start` even though the application is configured with `output: "standalone"`.

## Fix

- `npm run build` now invokes `next build` directly with the build-phase marker and then prepares the standalone runtime using filesystem APIs only.
- `public` is copied to `.next/standalone/public`.
- `.next/static` is copied to `.next/standalone/.next/static`.
- `npm run start` runs the generated standalone `server.js` directly.
- `npm run start:local` also runs the standalone server directly, loads `.env`, enables the loopback-only smoke mode, and binds to `127.0.0.1`.
- the obsolete helper files no longer contain process-spawning primitives, so the security audit remains fail-closed rather than adding an exception.

Local verification:

```bash
npm run build
npm run security:audit
npm run check
npm run start:local
```

Real production runtime:

```bash
npm run build
npm run start
```

The production runtime still requires production environment variables supplied by the deployment environment.
