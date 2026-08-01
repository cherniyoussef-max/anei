# ANEI v3.2.6 — local standalone launcher fix

## Fixed

- Removed top-level `await` from `scripts/start-local.ts`.
- The local production smoke launcher now executes through an async `main()` function, which is compatible with the CommonJS transform used by `tsx` in this project.
- Preserved the v3.2.5 loopback-only runtime configuration: `127.0.0.1`, local `APP_URL` / `BETTER_AUTH_URL` / `TRUSTED_ORIGINS`, and `ANEI_LOCAL_PRODUCTION=1`.
- No dependency, database, authentication-policy, or production-security changes.
