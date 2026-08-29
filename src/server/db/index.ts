import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/server/env";
import * as schema from "@/server/db/schema";
import { hardenPostgresConnectionString } from "@/server/db/connection-string";

type GlobalDb = typeof globalThis & { __aneiPool?: Pool };
const globalDb = globalThis as GlobalDb;

export const pool =
  globalDb.__aneiPool ??
  new Pool({
    connectionString: hardenPostgresConnectionString(env.DATABASE_URL),
    max: env.NODE_ENV === "production" ? env.DB_POOL_MAX : Math.min(env.DB_POOL_MAX, 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (env.NODE_ENV !== "production") globalDb.__aneiPool = pool;

export const db = drizzle(pool, { schema });
