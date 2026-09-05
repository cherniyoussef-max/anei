import "dotenv/config";
import { count } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import { courses, resources, user } from "../src/server/db/schema";
import { getPaymentCapabilities } from "../src/server/payments";

async function main() {
  try {
    const [users] = await db.select({ count: count() }).from(user);
    const [courseCount] = await db.select({ count: count() }).from(courses);
    const [resourceCount] = await db.select({ count: count() }).from(resources);

    console.table({
      users: users.count,
      courses: courseCount.count,
      resources: resourceCount.count,
    });
    console.table(getPaymentCapabilities());

    if (users.count < 2 || courseCount.count < 1) {
      throw new Error("Seed data missing");
    }

    console.log("Smoke check passed.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Smoke check failed");
  process.exitCode = 1;
});
