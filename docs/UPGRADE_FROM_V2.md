# Upgrade from the earlier ANEI v2/local prototype

This guide is for the existing local project/database that was previously created with `drizzle-kit push` and already contains the 22 original tables.

## 1. Back up the current working copy and database
For the current local Docker database, a simple development backup can be created before schema changes:
```bash
docker exec anei-postgres pg_dump -U anei -d anei -Fc > anei-before-v3.dump
```
Keep the dump outside the repository. For real production, use the managed backup/PITR process in `BACKUP_AND_RECOVERY.md` instead.

## 2. Replace/update source code
Use the delivered production-hardening source tree. Preserve your own real `.env`; do not overwrite it with `.env.example`.

Review new environment variables:
```bash
# compare manually
cat .env.example
```
For local development, the existing PostgreSQL/Redis/Mailpit values remain compatible.

## 3. Install dependencies and create the lockfile
```bash
npm install
```
This must generate `package-lock.json`. Commit the lockfile before CI/container deployment.

## 4. Start local infrastructure
```bash
docker compose up -d
docker compose ps
```

## 5. Migrate the existing database
The migration runner now handles the old `drizzle-kit push` database automatically. If it finds all expected v2 baseline tables and no migration journal, it records `0000_initial.sql` as already present and then applies `0001+`.

Run:
```bash
npm run db:migrate
```

This applies integrity constraints, indexes and the course-module hierarchy. If the database is only partially compatible, the command stops with a review error instead of replaying the initial schema. `npm run db:baseline` is retained only for explicit/manual recovery.

## 6. Verify migrations

Verify:
```bash
docker exec anei-postgres psql -U anei -d anei -c 'select version, applied_at from _anei_schema_migrations order by version;'
docker exec anei-postgres psql -U anei -d anei -c '\dt'
```
Expected migration files include `0000_initial.sql` through `0003_course_modules.sql`.

## 7. Seed only if this is still a demo/development database
For your current demo DB it is safe to rerun the idempotent demo seed:
```bash
npm run db:seed
```
Do **not** seed a real production/user database. Production uses `npm run db:bootstrap-admin` once with explicit bootstrap credentials.

## 8. Run the complete quality gate
```bash
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run security:audit
npm run build
npm run verify
```
Then:
```bash
npm run start
```
and smoke-test the production build, not only `next dev`.

## 9. Local development
```bash
npm run dev
```
Use `http://localhost:3000/fr` or `/ar`. If intentionally testing from another device on the LAN, set `DEV_ALLOWED_ORIGINS` to the required development host(s) and restart Next.js rather than weakening production origin policy.

## 10. Before real deployment
Complete every unchecked item in `PRODUCTION_CHECKLIST.md`, especially external provider acceptance, real object-storage configuration, SMTP, monitoring, backup restore drill, legal/privacy review and authorized staging pentest.
