import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { orders, payments } from "@/server/db/schema";
import { verifyAndApplyPayment } from "@/server/services/checkout";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const schema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`payment-verify:${session.user.id}`, 10, 60);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const [row] = await db
    .select({ order: orders, payment: payments })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(and(eq(orders.id, parsed.data.orderId), eq(orders.userId, session.user.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (row.order.status === "paid") return NextResponse.json({ status: "paid" });
  if (!row.payment || row.payment.provider === "mock") return NextResponse.json({ status: row.order.status });

  try {
    const result = await verifyAndApplyPayment(row.payment.id);
    return NextResponse.json({ status: result.status });
  } catch {
    return NextResponse.json({ error: "VERIFICATION_UNAVAILABLE" }, { status: 503 });
  }
}
