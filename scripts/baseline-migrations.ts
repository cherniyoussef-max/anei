import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { getDatabaseUrl } from "./migration-env";

const databaseUrl = getDatabaseUrl();
const baseline = "0000_initial.sql";
const requiredTables = ["user", "account", "session", "courses", "lessons", "resources", "orders", "payments", "webinars"];

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const rows = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    const existing = new Set(rows.rows.map((row) => row.tablename));
    const missing = requiredTables.filter((table) => !existing.has(table));
    if (missing.length) {
      throw new Error(`Cannot baseline an incomplete database. Missing: ${missing.join(", ")}`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "_anei_schema_migrations" (
        "version" text PRIMARY KEY,
        "checksum" text NOT NULL,
        "applied_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    const content = await readFile(path.resolve(process.cwd(), "drizzle", baseline), "utf8");
    const digest = createHash("sha256").update(content).digest("hex");
    const current = await client.query<{ checksum: string }>(
      'SELECT "checksum" FROM "_anei_schema_migrations" WHERE "version"=$1',
      [baseline],
    );
    if (current.rowCount && current.rows[0].checksum !== digest) {
      throw new Error(`Existing baseline checksum does not match ${baseline}.`);
    }
    await client.query(
      'INSERT INTO "_anei_schema_migrations" ("version", "checksum") VALUES ($1,$2) ON CONFLICT ("version") DO NOTHING',
      [baseline, digest],
    );
    console.log(`Baselined ${baseline}. Run npm run db:migrate to apply later migrations.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
