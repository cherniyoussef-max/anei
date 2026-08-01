import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, orders, payments } from "@/server/db/schema";
import { grantOrder, verifyAndApplyPayment } from "@/server/services/checkout";
import { isTrustedMutation } from "@/server/security/origin";

const idSchema = z.string().uuid();

/**
 * Operational reconciliation never grants an unpaid order. For paid orders it
 * repairs a missing entitlement idempotently; otherwise it asks the configured
 * provider to verify the existing external payment first.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("payments.reconcile");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [row] = await db
    .select({ order: orders, payment: payments })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(eq(orders.id, id.data))
    .limit(1);
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    if (row.order.status === "paid") {
      await grantOrder(row.order.id);
    } else if (row.payment?.externalPaymentId && row.payment.provider !== "mock") {
      await verifyAndApplyPayment(row.payment.id);
    } else {
      return NextResponse.json({ error: "NOT_RECONCILABLE" }, { status: 409 });
    }
    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "order.reconcile",
      entityType: "order",
      entityId: row.order.id,
      metadata: { previousStatus: row.order.status, provider: row.order.provider },
    });
    const [updated] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, row.order.id)).limit(1);
    return NextResponse.json({ ok: true, status: updated?.status ?? row.order.status });
  } catch {
    return NextResponse.json({ error: "RECONCILIATION_FAILED" }, { status: 503 });
  }
}
