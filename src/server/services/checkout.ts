import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  courses,
  enrollments,
  notifications,
  orders,
  payments,
  purchases,
  resources,
  user,
} from "@/server/db/schema";
import { getPaymentGateway } from "@/server/payments";
import type { PaymentProvider, VerificationResult } from "@/server/payments/types";
import { logger } from "@/server/security/logger";

export type OrderItemType = "course" | "resource";
type OrderRow = typeof orders.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function hasEntitlement(userId: string, type: OrderItemType, itemId: string) {
  if (type === "course") {
    const row = await db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, itemId)),
    });
    return Boolean(row);
  }
  const row = await db.query.purchases.findFirst({
    where: and(eq(purchases.userId, userId), eq(purchases.resourceId, itemId)),
  });
  return Boolean(row);
}

export async function resolveSellableItem(type: OrderItemType, itemId: string) {
  if (type === "course") {
    const [item] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, itemId), eq(courses.published, true)))
      .limit(1);
    return item ? { id: item.id, label: item.titleFr, amountMillimes: item.priceMillimes } : null;
  }

  const [item] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.id, itemId), eq(resources.published, true)))
    .limit(1);
  return item ? { id: item.id, label: item.titleFr, amountMillimes: item.priceMillimes } : null;
}

async function grantPaidOrderTx(tx: Transaction, order: OrderRow) {
  let granted = false;

  if (order.itemType === "course") {
    const inserted = await tx
      .insert(enrollments)
      .values({ userId: order.userId, courseId: order.itemId })
      .onConflictDoNothing({ target: [enrollments.userId, enrollments.courseId] })
      .returning({ id: enrollments.id });
    granted = inserted.length > 0;
  } else if (order.itemType === "resource") {
    const inserted = await tx
      .insert(purchases)
      .values({ userId: order.userId, orderId: order.id, resourceId: order.itemId })
      .onConflictDoNothing({ target: [purchases.userId, purchases.resourceId] })
      .returning({ id: purchases.id });
    granted = inserted.length > 0;
  } else {
    throw new Error("UNSUPPORTED_ORDER_ITEM_TYPE");
  }

  if (!granted) return false;

  const [owner] = await tx.select({ locale: user.locale }).from(user).where(eq(user.id, order.userId)).limit(1);
  const locale = owner?.locale === "ar" ? "ar" : "fr";

  await tx.insert(notifications).values({
    userId: order.userId,
    type: "purchase",
    title: locale === "ar" ? "تم تفعيل الوصول" : "Accès activé",
    body:
      locale === "ar"
        ? `أصبح وصولك إلى « ${order.itemLabel} » مفعّلاً الآن.`
        : `Votre accès à « ${order.itemLabel} » est maintenant actif.`,
    href: `/${locale}/dashboard`,
  });

  await tx.insert(auditLogs).values({
    actorUserId: order.userId,
    action: "entitlement.granted",
    entityType: order.itemType,
    entityId: order.itemId,
    metadata: { orderId: order.id, provider: order.provider },
  });

  return true;
}

export async function createOrderCheckout(input: {
  userId: string;
  userName: string;
  userEmail: string;
  locale: "fr" | "ar";
  itemType: OrderItemType;
  itemId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
}) {
  const existing = await db.query.orders.findFirst({
    where: and(eq(orders.userId, input.userId), eq(orders.idempotencyKey, input.idempotencyKey)),
  });
  if (existing) {
    const payment = await db.query.payments.findFirst({ where: eq(payments.orderId, existing.id) });
    return { order: existing, payment, reused: true };
  }

  const item = await resolveSellableItem(input.itemType, input.itemId);
  if (!item) throw new Error("ITEM_NOT_FOUND");

  if (item.amountMillimes === 0) {
    const order = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          userId: input.userId,
          itemType: input.itemType,
          itemId: item.id,
          itemLabel: item.label,
          amountMillimes: 0,
          status: "paid",
          provider: "free",
          idempotencyKey: input.idempotencyKey,
        })
        .returning();
      await grantPaidOrderTx(tx, created);
      return created;
    });
    return { order, payment: null, reused: false };
  }

  const gateway = getPaymentGateway(input.provider);
  if (!gateway.isConfigured()) throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED");

  const [order] = await db
    .insert(orders)
    .values({
      userId: input.userId,
      itemType: input.itemType,
      itemId: item.id,
      itemLabel: item.label,
      amountMillimes: item.amountMillimes,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
    })
    .returning();

  try {
    const checkout = await gateway.createCheckout({
      orderId: order.id,
      amountMillimes: order.amountMillimes,
      currency: "TND",
      customerName: input.userName,
      customerEmail: input.userEmail,
      locale: input.locale,
    });
    const [payment] = await db
      .insert(payments)
      .values({
        orderId: order.id,
        provider: input.provider,
        externalPaymentId: checkout.externalPaymentId,
        amountMillimes: order.amountMillimes,
        checkoutUrl: checkout.checkoutUrl,
        raw: checkout.raw,
      })
      .returning();
    return { order, payment, reused: false };
  } catch (error) {
    await db.update(orders).set({ status: "failed", updatedAt: new Date() }).where(eq(orders.id, order.id));
    logger.error("payment.checkout_creation_failed", {
      orderId: order.id,
      provider: input.provider,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}

export async function verifyAndApplyPayment(paymentId: string): Promise<VerificationResult> {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment?.externalPaymentId) throw new Error("PAYMENT_NOT_FOUND");
  const result = await getPaymentGateway(payment.provider as PaymentProvider).verify(payment.externalPaymentId);
  await applyVerification(payment.id, payment.orderId, result);
  return result;
}

export async function verifyAndApplyByExternalId(provider: PaymentProvider, externalPaymentId: string) {
  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.provider, provider), eq(payments.externalPaymentId, externalPaymentId)),
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  const result = await getPaymentGateway(provider).verify(externalPaymentId);
  await applyVerification(payment.id, payment.orderId, result);
  return { payment, result };
}

async function applyVerification(paymentId: string, orderId: string, result: VerificationResult) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new Error("ORDER_NOT_FOUND");

    // Paid is a terminal, authoritative state. A later re-verification (retry,
    // stale provider read, replay) must never downgrade an order that has
    // already been confirmed paid, even if the provider now reports pending/failed.
    if (order.status === "paid") return;

    // A payment provider can only confirm the server-side amount that was recorded
    // when the order was created. Client totals never participate in this decision.
    const amountMatches = result.amountMillimes === undefined || result.amountMillimes === order.amountMillimes;
    const referenceMatches = result.merchantReference === undefined || result.merchantReference === order.id;
    const normalized: VerificationResult["status"] = result.status === "paid" && (!amountMatches || !referenceMatches) ? "failed" : result.status;
    const status = normalized;

    await tx
      .update(payments)
      .set({ status, raw: { ...(result.raw ?? {}), amountMatches, referenceMatches }, updatedAt: new Date() })
      .where(eq(payments.id, paymentId));
    await tx.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId));

    if (status === "paid") await grantPaidOrderTx(tx, order);
  });
}

export async function markMockOrderPaid(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.provider, "mock")))
      .limit(1);
    if (!order) throw new Error("ORDER_NOT_FOUND");

    await tx.update(orders).set({ status: "paid", updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.update(payments).set({ status: "paid", updatedAt: new Date() }).where(eq(payments.orderId, orderId));
    await grantPaidOrderTx(tx, { ...order, status: "paid" });
  });
}

/**
 * Recovery helper for operations/reconciliation. The order must already be paid.
 * The entitlement grant is still idempotent because DB uniqueness is authoritative.
 */
export async function grantOrder(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.status !== "paid") return;
    await grantPaidOrderTx(tx, order);
  });
}
