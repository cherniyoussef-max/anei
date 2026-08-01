import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { getDatabaseUrl } from "./migration-env";

const migrationsDir = path.resolve(process.cwd(), "drizzle");
const databaseUrl = getDatabaseUrl();
const BASELINE = "0000_initial.sql";
const BASELINE_TABLES = ["user", "account", "session", "courses", "lessons", "resources", "orders", "payments", "webinars"];

function checksum(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_anei_schema_migrations" (
      "version" text PRIMARY KEY,
      "checksum" text NOT NULL,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function maybeBaselineExistingV2(client: Client, files: string[]) {
  const applied = await client.query<{ version: string }>('SELECT "version" FROM "_anei_schema_migrations" ORDER BY "version"');
  if (applied.rowCount) return;

  const rows = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  const existing = new Set(rows.rows.map((row) => row.tablename).filter((name) => name !== "_anei_schema_migrations"));
  const baselinePresent = BASELINE_TABLES.filter((table) => existing.has(table));

  if (existing.size === 0) return; // Fresh DB: 0000 will create everything.

  if (baselinePresent.length !== BASELINE_TABLES.length) {
    const missing = BASELINE_TABLES.filter((table) => !existing.has(table));
    throw new Error(
      `Refusing to migrate a partial/unrecognized database. Existing ANEI tables were detected but baseline tables are missing: ${missing.join(", ")}. ` +
      "Back up the database and inspect it before migrating.",
    );
  }

  if (!files.includes(BASELINE)) throw new Error(`Missing required baseline migration ${BASELINE}.`);
  const content = await readFile(path.join(migrationsDir, BASELINE), "utf8");
  await client.query(
    'INSERT INTO "_anei_schema_migrations" ("version", "checksum") VALUES ($1,$2)',
    [BASELINE, checksum(content)],
  );
  console.log(`[baseline] Existing v2 schema recorded as ${BASELINE}; later migrations will now be applied.`);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [73194721]);
    await ensureMigrationTable(client);

    const files = (await readdir(migrationsDir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    await maybeBaselineExistingV2(client, files);

    for (const version of files) {
      const sql = await readFile(path.join(migrationsDir, version), "utf8");
      const digest = checksum(sql);
      const applied = await client.query<{ checksum: string }>(
        'SELECT "checksum" FROM "_anei_schema_migrations" WHERE "version" = $1',
        [version],
      );
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== digest) {
          throw new Error(`Migration ${version} was modified after being applied.`);
        }
        console.log(`[skip] ${version}`);
        continue;
      }

      console.log(`[apply] ${version}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_anei_schema_migrations" ("version", "checksum") VALUES ($1,$2)',
          [version, digest],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("Database migrations are up to date.");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [73194721]).catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
