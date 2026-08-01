# Database

## Source of truth
PostgreSQL is authoritative. Drizzle defines the TypeScript schema; immutable/versioned SQL under `drizzle/` defines production evolution.

Current migration chain:
1. `0000_initial.sql` — verified baseline schema.
2. `0001_integrity_constraints.sql` — business integrity/check constraints and purchase/certificate uniqueness.
3. `0002_query_indexes.sql` — indexes matching common public/admin query patterns.
4. `0003_course_modules.sql` — backward-compatible course modules/chapters and optional `lessons.module_id`.

## Fresh database
```bash
npm run db:migrate
npm run db:seed   # development/test demo only
```

## Upgrade the user's existing local DB created with the old `db:push`
Your existing database already has the `0000` tables but no migration journal. Do **not** reset it just to adopt migrations.

Run once:
```bash
npm run db:baseline
npm run db:migrate
```

`db:baseline` verifies core tables, records only the checksum of `0000_initial.sql`, then `db:migrate` applies `0001+` normally. Run it only for an existing DB that predates this migration journal.

Verify:
```bash
docker exec anei-postgres psql -U anei -d anei -c '\dt'
docker exec anei-postgres psql -U anei -d anei -c 'select version, applied_at from _anei_schema_migrations order by version;'
```

## Production rules
- Never run `drizzle-kit push --force` against production user data.
- Review every migration SQL before release.
- Back up before destructive/risky changes and test restore independently.
- Migration runner serializes releases with a PostgreSQL advisory lock and records SHA-256 checksums; applied history must not be edited.
- Prefer expand/migrate/contract changes for zero/low-downtime rolling deployments.
- Run schema migrations as an explicit release step, not concurrently from every web replica.

## Integrity controls
PostgreSQL, not just the browser, enforces important invariants:
- role/locale/profile allowlists;
- positive course/module positions and duration rules;
- non-negative course/resource/order/payment amounts;
- enrollment progress `0..100` and status allowlists;
- TND currency/provider/item-type/status constraints;
- unique enrollment per user/course;
- unique lesson position per course;
- unique module position per course;
- unique certificate code and one certificate per user/course;
- unique resource entitlement per user/resource;
- unique webinar registration;
- payment provider/external transaction uniqueness and order idempotency.

## Money
Authoritative payment amounts are integer **millimes** and currency is TND. The server resolves the sellable item's price from PostgreSQL; client-submitted totals never decide access.

## Query scale
Public course/resource/AVS discovery is server-side and paginated. Common published/status/date/type/price queries have B-tree indexes. `%substring%` search currently uses parameterized `ILIKE`; measure real traffic before adding `pg_trgm`/GIN. Avoid speculative indexes.

## Pooling
`DB_POOL_MAX` caps connections per application replica. Size the aggregate pool below managed PostgreSQL limits. Add PgBouncer when replica/connection volume warrants it; test prepared-statement compatibility with the selected mode.
