# v3.1 corrective release

This corrective release addresses issues observed during the first real local validation of v3.

## Fixed
- migration scripts load `.env.local`/`.env` and use the documented local Docker PostgreSQL URL only outside production;
- `db:migrate` auto-baselines a complete legacy v2 schema before applying later migrations;
- `course_modules` is therefore created before the v3 seed runs;
- bootstrap SUPER_ADMIN environment values are type-narrowed safely;
- admin pagination preserves query filters and supplies required route metadata;
- catalog filter values retain their literal union types;
- Redis 6 client inference uses one concrete client type and a `Promise<void>` connection singleton;
- seed no longer declares the reserved CommonJS `module` identifier;
- account export uses Next `Link`;
- payment success uses immutable query result binding;
- session initialization no longer synchronously triggers state-setting through an effect helper;
- ClicToPay fail-closed adapter has no unused parameters;
- k6 smoke default export is named;
- Playwright setup script installs Chromium explicitly;
- local PostgreSQL integration tests use the documented local Docker DB by default outside production;
- README includes stale dev-server and ZIP-without-Git troubleshooting.

## Upgrade commands for the existing local v2/v3 database
```bash
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run security:audit
npm run build
npm run verify
npm run test:e2e:setup
npm run test:e2e
```

Do not run the demo seed against a real production database.
