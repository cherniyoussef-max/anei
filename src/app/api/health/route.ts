import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { getPaymentCapabilities } from "@/server/payments";
import { googleAuthConfigured } from "@/server/env";
import { checkRedis } from "@/server/cache/redis";

export async function GET() {
  let database = false;
  try { await db.execute(sql`select 1`); database = true; } catch { database = false; }
  const redis = await checkRedis();
  return NextResponse.json({
    ok: database,
    database,
    redis,
    auth: { emailPassword: true, googleConfigured: googleAuthConfigured },
    payments: getPaymentCapabilities(),
    timestamp: new Date().toISOString(),
  }, { status: database ? 200 : 503 });
}
