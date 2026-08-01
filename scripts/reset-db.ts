import "dotenv/config";
import { Pool } from "pg";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing database reset in NODE_ENV=production.");
}
if (process.env.ALLOW_DB_RESET !== "true") {
  throw new Error("Refusing destructive reset. Set ALLOW_DB_RESET=true explicitly for a disposable local database.");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const parsed = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("Refusing reset because DATABASE_URL is not local.");
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query("drop schema public cascade; create schema public;");
  console.log("Local database schema reset. Next run: npm run db:migrate && npm run db:seed");
} finally {
  await pool.end();
}
