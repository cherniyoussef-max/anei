import { config } from "dotenv";

// Next.js loads .env files automatically, standalone TS scripts do not.
// Mirror the useful local behavior here without ever inventing production credentials.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function getDatabaseUrl() {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }

  // Matches docker-compose.yml development defaults only.
  return "postgresql://anei:anei@127.0.0.1:5432/anei";
}
