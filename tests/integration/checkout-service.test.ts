/**
 * Behavioral regression coverage for the checkout/payment service
 * (src/server/services/checkout.ts) against a real database, following the
 * pattern in tests/integration/flouci-webhook.test.ts. The Flouci gateway is
 * used as the non-mock provider under test (mock provider `verify()` always
 * returns "pending" and never grants, so it cannot exercise the
 * paid/mismatch/downgrade paths); its outbound fetch is stubbed so no network
 * call is made.
 */
process.env.ENABLE_FLOUCI = "true";
process.env.FLOUCI_PUBLIC_KEY = "test-public-key";
process.env.FLOUCI_PRIVATE_KEY = "test-private-key";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);

async function withClient(run: (client: Client) => Promise<void>) {
  if (!url) return;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

async function seedUser(client: Client, label: string) {
  const userId = crypto.randomUUID();
  await client.query(
    `insert into "user" (id, name, email, email_verified, role, created_at, updated_at) values ($1, $2, $3, true, 'USER', now(), now())`,
    [userId, label, `${label}-${userId}@example.test`],
  );
  return userId;
}

async function seedResource(client: Client, priceMillimes: number) {
  const resourceId = crypto.randomUUID();
  await client.query(
    `insert into resources
      (id, slug, title_fr, title_ar, description_fr, description_ar, audience_fr, audience_ar, type, price_millimes, published, created_at)
     values ($1, $2, 'Guide', 'دليل', 'desc', 'وصف', 'public', 'الجمهور', 'Guide PDF', $3, true, now())`,
    [resourceId, `checkout-service-resource-${resourceId}`, priceMillimes],
  );
  return resourceId;
}

async function seedCourse(client: Client, priceMillimes: number) {
  const courseId = crypto.randomUUID();
  await client.query(
    `insert into courses
      (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
       category, level, mode, trainer_name, duration_minutes, price_millimes, published, featured,
       objectives, created_at, updated_at)
     values ($1,$2,'Course','دورة','Sum','ملخص','Desc','وصف','test','beginner','online',
             'ANEI',60,$3,true,false,$4::jsonb,now(),now())`,
    [courseId, `checkout-service-course-${courseId}`, priceMillimes, JSON.stringify({ fr: [], ar: [] })],
  );
  return courseId;
}

async function seedOrderAndPayment(
  client: Client,
  opts: { userId: string; itemType: "course" | "resource"; itemId: string; amountMillimes: number; provider?: string },
) {
  const orderId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const externalPaymentId = `flouci-ext-${crypto.randomUUID()}`;
  const provider = opts.provider ?? "flouci";
  await client.query(
    `insert into orders (id, user_id, item_type, item_id, item_label, amount_millimes, status, provider, idempotency_key, created_at, updated_at)
     values ($1, $2, $3, $4, 'Item', $5, 'pending', $6, $7, now(), now())`,
    [orderId, opts.userId, opts.itemType, opts.itemId, opts.amountMillimes, provider, crypto.randomUUID()],
  );
  await client.query(
    `insert into payments (id, order_id, provider, external_payment_id, status, amount_millimes, created_at, updated_at)
     values ($1, $2, $3, $4, 'pending', $5, now(), now())`,
    [paymentId, orderId, provider, externalPaymentId, opts.amountMillimes],
  );
  return { orderId, paymentId, externalPaymentId };
}

async function cleanup(client: Client, userIds: string[], resourceIds: string[] = [], courseIds: string[] = []) {
  await client.query("delete from enrollments where user_id = any($1)", [userIds]);
  await client.query("delete from purchases where user_id = any($1)", [userIds]);
  await client.query("delete from payments where order_id in (select id from orders where user_id = any($1))", [userIds]);
  await client.query("delete from orders where user_id = any($1)", [userIds]);
  await client.query('delete from "user" where id = any($1)', [userIds]);
  if (resourceIds.length) await client.query("delete from resources where id = any($1)", [resourceIds]);
  if (courseIds.length) await client.query("delete from courses where id = any($1)", [courseIds]);
}

function flouciVerifyResponse(status: "SUCCESS" | "PENDING" | "FAILURE" | "EXPIRED", amount: number, developerTrackingId: string) {
  return new Response(JSON.stringify({ success: true, result: { status, amount, developer_tracking_id: developerTrackingId } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function withStubbedFetch<T>(impl: typeof fetch, run: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("checkout creation is idempotent: replaying the same idempotency key reuses the same order and payment", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { createOrderCheckout } = await import("../../src/server/services/checkout");
    const userId = await seedUser(client, "Idempotent Checkout");
    const resourceId = await seedResource(client, 3000);
    const idempotencyKey = crypto.randomUUID();

    try {
      const first = await createOrderCheckout({
        userId,
        userName: "Test User",
        userEmail: "idempotent@example.test",
        locale: "fr",
        itemType: "resource",
        itemId: resourceId,
        provider: "mock",
        idempotencyKey,
      });
      const second = await createOrderCheckout({
        userId,
        userName: "Test User",
        userEmail: "idempotent@example.test",
        locale: "fr",
        itemType: "resource",
        itemId: resourceId,
        provider: "mock",
        idempotencyKey,
      });

      assert.equal(second.order.id, first.order.id);
      assert.equal(second.reused, true);

      const orderCount = await client.query("select count(*) from orders where user_id = $1", [userId]);
      assert.equal(Number(orderCount.rows[0].count), 1, "a replayed idempotency key must never create a second order");

      const paymentCount = await client.query("select count(*) from payments where order_id = $1", [first.order.id]);
      assert.equal(Number(paymentCount.rows[0].count), 1);
    } finally {
      await cleanup(client, [userId], [resourceId]);
    }
  });
});

test("free items are checked out as already paid, grant entitlement immediately, and create no payment row", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { createOrderCheckout } = await import("../../src/server/services/checkout");
    const userId = await seedUser(client, "Free Item Checkout");
    const resourceId = await seedResource(client, 0);

    try {
      const result = await createOrderCheckout({
        userId,
        userName: "Test User",
        userEmail: "free@example.test",
        locale: "fr",
        itemType: "resource",
        itemId: resourceId,
        provider: "mock",
        idempotencyKey: crypto.randomUUID(),
      });

      assert.equal(result.order.status, "paid");
      assert.equal(result.order.amountMillimes, 0);
      assert.equal(result.payment, null);

      const purchases = await client.query("select count(*) from purchases where user_id = $1 and resource_id = $2", [userId, resourceId]);
      assert.equal(Number(purchases.rows[0].count), 1);
    } finally {
      await cleanup(client, [userId], [resourceId]);
    }
  });
});

test("a provider checkout-creation failure leaves the order failed, with no payment row and no entitlement", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { createOrderCheckout } = await import("../../src/server/services/checkout");
    const userId = await seedUser(client, "Provider Failure");
    const resourceId = await seedResource(client, 5000);

    try {
      await withStubbedFetch(
        (async () => {
          throw new Error("simulated provider outage");
        }) as typeof fetch,
        async () => {
          await assert.rejects(() =>
            createOrderCheckout({
              userId,
              userName: "Test User",
              userEmail: "failure@example.test",
              locale: "fr",
              itemType: "resource",
              itemId: resourceId,
              provider: "flouci",
              idempotencyKey: crypto.randomUUID(),
            }),
          );
        },
      );

      const orderRow = await client.query("select id, status from orders where user_id = $1", [userId]);
      assert.equal(orderRow.rows[0].status, "failed");

      const paymentCount = await client.query("select count(*) from payments where order_id = $1", [orderRow.rows[0].id]);
      assert.equal(Number(paymentCount.rows[0].count), 0, "a failed checkout creation must not leave a payment row behind");

      const purchases = await client.query("select count(*) from purchases where user_id = $1", [userId]);
      assert.equal(Number(purchases.rows[0].count), 0);
    } finally {
      await cleanup(client, [userId], [resourceId]);
    }
  });
});

test("a provider PAID confirmation with a mismatched amount is rejected: no paid state, no entitlement", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const userId = await seedUser(client, "Amount Mismatch");
    const resourceId = await seedResource(client, 5000);
    const { orderId, externalPaymentId } = await seedOrderAndPayment(client, { userId, itemType: "resource", itemId: resourceId, amountMillimes: 5000 });

    try {
      await withStubbedFetch(
        (async () => flouciVerifyResponse("SUCCESS", 3000, orderId)) as typeof fetch,
        () => verifyAndApplyByExternalId("flouci", externalPaymentId),
      );

      const order = await client.query("select status from orders where id = $1", [orderId]);
      assert.notEqual(order.rows[0].status, "paid", "an amount mismatch must never be accepted as paid");

      const purchases = await client.query("select count(*) from purchases where order_id = $1", [orderId]);
      assert.equal(Number(purchases.rows[0].count), 0);
    } finally {
      await cleanup(client, [userId], [resourceId]);
    }
  });
});

test("an already-paid order is not downgraded by a later non-paid verification (stale read / retry)", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const userId = await seedUser(client, "Already Final");
    const resourceId = await seedResource(client, 5000);
    const { orderId, externalPaymentId } = await seedOrderAndPayment(client, { userId, itemType: "resource", itemId: resourceId, amountMillimes: 5000 });

    try {
      await withStubbedFetch(
        (async () => flouciVerifyResponse("SUCCESS", 5000, orderId)) as typeof fetch,
        () => verifyAndApplyByExternalId("flouci", externalPaymentId),
      );
      const afterPaid = await client.query("select status from orders where id = $1", [orderId]);
      assert.equal(afterPaid.rows[0].status, "paid");

      // A stale/retried verification later reports PENDING for the same payment.
      await withStubbedFetch(
        (async () => flouciVerifyResponse("PENDING", 5000, orderId)) as typeof fetch,
        () => verifyAndApplyByExternalId("flouci", externalPaymentId),
      );
      const afterStalePending = await client.query("select status from orders where id = $1", [orderId]);
      assert.equal(afterStalePending.rows[0].status, "paid", "a paid order must remain paid, never be downgraded by a later non-paid read");

      const purchases = await client.query("select count(*) from purchases where order_id = $1", [orderId]);
      assert.equal(Number(purchases.rows[0].count), 1, "the entitlement granted at PAID time must not be affected by the later downgrade attempt");
    } finally {
      await cleanup(client, [userId], [resourceId]);
    }
  });
});

test("cross-user isolation: verifying one user's payment never grants entitlement to another user", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const userA = await seedUser(client, "User A");
    const userB = await seedUser(client, "User B");
    const resourceId = await seedResource(client, 5000);
    const orderA = await seedOrderAndPayment(client, { userId: userA, itemType: "resource", itemId: resourceId, amountMillimes: 5000 });
    const orderB = await seedOrderAndPayment(client, { userId: userB, itemType: "resource", itemId: resourceId, amountMillimes: 5000 });

    try {
      await withStubbedFetch(
        (async () => flouciVerifyResponse("SUCCESS", 5000, orderA.orderId)) as typeof fetch,
        () => verifyAndApplyByExternalId("flouci", orderA.externalPaymentId),
      );

      const purchasesA = await client.query("select count(*) from purchases where user_id = $1 and resource_id = $2", [userA, resourceId]);
      assert.equal(Number(purchasesA.rows[0].count), 1);

      const purchasesB = await client.query("select count(*) from purchases where user_id = $1 and resource_id = $2", [userB, resourceId]);
      assert.equal(Number(purchasesB.rows[0].count), 0, "user B must not receive an entitlement from user A's payment");

      const orderBRow = await client.query("select status from orders where id = $1", [orderB.orderId]);
      assert.equal(orderBRow.rows[0].status, "pending", "an unrelated order must not be mutated by another user's verification");
    } finally {
      await cleanup(client, [userA, userB], [resourceId]);
    }
  });
});

test("a course PAID confirmation grants an enrollment exactly once, preserving integer millimes end-to-end", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const userId = await seedUser(client, "Course Buyer");
    const courseId = await seedCourse(client, 12345);
    const { orderId, externalPaymentId } = await seedOrderAndPayment(client, { userId, itemType: "course", itemId: courseId, amountMillimes: 12345 });

    try {
      await withStubbedFetch(
        (async () => flouciVerifyResponse("SUCCESS", 12345, orderId)) as typeof fetch,
        () => verifyAndApplyByExternalId("flouci", externalPaymentId),
      );

      const order = await client.query("select status, amount_millimes from orders where id = $1", [orderId]);
      assert.equal(order.rows[0].status, "paid");
      assert.equal(Number(order.rows[0].amount_millimes), 12345, "the persisted amount must stay an exact integer millimes value, not a float-rounded one");

      const payment = await client.query("select amount_millimes from payments where order_id = $1", [orderId]);
      assert.equal(Number(payment.rows[0].amount_millimes), 12345);

      const enrollment = await client.query("select count(*) from enrollments where user_id = $1 and course_id = $2", [userId, courseId]);
      assert.equal(Number(enrollment.rows[0].count), 1);

      // Duplicate confirmation must not create a second enrollment row.
      await withStubbedFetch(
        (async () => flouciVerifyResponse("SUCCESS", 12345, orderId)) as typeof fetch,
        () => verifyAndApplyByExternalId("flouci", externalPaymentId),
      );
      const enrollmentAfterDuplicate = await client.query("select count(*) from enrollments where user_id = $1 and course_id = $2", [userId, courseId]);
      assert.equal(Number(enrollmentAfterDuplicate.rows[0].count), 1);
    } finally {
      await cleanup(client, [userId], [], [courseId]);
    }
  });
});
