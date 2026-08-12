/**
 * The webhook route (src/app/api/payments/flouci/webhook/route.ts) transitively
 * imports src/server/security/logger.ts and src/server/security/rate-limit.ts,
 * both guarded by `import "server-only"`, which throws outside a Next.js server
 * context (same constraint as src/server/auth/session.ts, see
 * tests/integration/admin-role-session.test.ts). So this exercises the actual
 * payment-verification core the route calls — verifyAndApplyByExternalId — which
 * has no such guard, against a real database and a stubbed Flouci API. The
 * route's request-handling wrapper (validation, rate limiting, status mapping)
 * is covered by tests/unit/flouci-webhook-route.test.ts via source inspection.
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

async function seedOrder(client: Client, opts: { amountMillimes: number }) {
  const userId = crypto.randomUUID();
  const resourceId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const externalPaymentId = `flouci-ext-${crypto.randomUUID()}`;

  await client.query(
    `insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
     values ($1, 'Webhook Test', $2, true, 'USER', now(), now())`,
    [userId, `flouci-webhook-${userId}@example.test`],
  );
  await client.query(
    `insert into resources
      (id, slug, title_fr, title_ar, description_fr, description_ar, audience_fr, audience_ar, type, price_millimes, published, created_at)
     values ($1, $2, 'Guide', 'دليل', 'desc', 'وصف', 'public', 'الجمهور', 'Guide PDF', $3, true, now())`,
    [resourceId, `flouci-webhook-resource-${resourceId}`, opts.amountMillimes],
  );
  await client.query(
    `insert into orders (id, user_id, item_type, item_id, item_label, amount_millimes, status, provider, idempotency_key, created_at, updated_at)
     values ($1, $2, 'resource', $3, 'Guide', $4, 'pending', 'flouci', $5, now(), now())`,
    [orderId, userId, resourceId, opts.amountMillimes, crypto.randomUUID()],
  );
  await client.query(
    `insert into payments (id, order_id, provider, external_payment_id, status, amount_millimes, created_at, updated_at)
     values ($1, $2, 'flouci', $3, 'pending', $4, now(), now())`,
    [paymentId, orderId, externalPaymentId, opts.amountMillimes],
  );

  return { userId, orderId, paymentId, resourceId, externalPaymentId };
}

async function cleanup(client: Client, userId: string, resourceId: string) {
  await client.query("delete from purchases where user_id = $1", [userId]);
  await client.query("delete from payments where order_id in (select id from orders where user_id = $1)", [userId]);
  await client.query("delete from orders where user_id = $1", [userId]);
  await client.query('delete from "user" where id = $1', [userId]);
  await client.query("delete from resources where id = $1", [resourceId]);
}

function flouciVerifyResponse(status: "SUCCESS" | "PENDING" | "FAILURE" | "EXPIRED", amount: number, developerTrackingId: string) {
  return new Response(JSON.stringify({ success: true, result: { status, amount, developer_tracking_id: developerTrackingId } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("an unknown external payment id is rejected without corrupting any state", { skip: !url }, async () => {
  const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("must not be called for an unknown payment id");
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => verifyAndApplyByExternalId("flouci", `nonexistent-${crypto.randomUUID()}`),
      /PAYMENT_NOT_FOUND/,
    );
    assert.equal(fetchCalls, 0, "an unknown payment id must never trigger an outbound Flouci call");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("webhook-claimed status is never trusted: a PENDING provider response cannot mark the order paid", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const { userId, orderId, resourceId, externalPaymentId } = await seedOrder(client, { amountMillimes: 5000 });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => flouciVerifyResponse("PENDING", 5000, orderId)) as typeof fetch;

    try {
      // Re-verification is the only source of truth; a caller claiming SUCCESS has no bearing on it.
      await verifyAndApplyByExternalId("flouci", externalPaymentId);

      const order = await client.query("select status from orders where id = $1", [orderId]);
      assert.equal(order.rows[0].status, "pending");

      const purchases = await client.query("select count(*) from purchases where order_id = $1", [orderId]);
      assert.equal(Number(purchases.rows[0].count), 0);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(client, userId, resourceId);
    }
  });
});

test("provider PAID confirmation grants entitlement exactly once across duplicate callbacks", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const { userId, orderId, resourceId, externalPaymentId } = await seedOrder(client, { amountMillimes: 5000 });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => flouciVerifyResponse("SUCCESS", 5000, orderId)) as typeof fetch;

    try {
      await verifyAndApplyByExternalId("flouci", externalPaymentId);

      const order = await client.query("select status from orders where id = $1", [orderId]);
      assert.equal(order.rows[0].status, "paid");

      const purchasesAfterFirst = await client.query("select count(*) from purchases where order_id = $1", [orderId]);
      assert.equal(Number(purchasesAfterFirst.rows[0].count), 1);

      // Duplicate callback for the same already-final payment (Flouci retry, replay, etc).
      await verifyAndApplyByExternalId("flouci", externalPaymentId);

      const purchasesAfterSecond = await client.query("select count(*) from purchases where order_id = $1", [orderId]);
      assert.equal(Number(purchasesAfterSecond.rows[0].count), 1, "entitlement must be granted at most once");

      const orderAfter = await client.query("select status from orders where id = $1", [orderId]);
      assert.equal(orderAfter.rows[0].status, "paid", "an already-paid order must remain paid, not be reprocessed");
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(client, userId, resourceId);
    }
  });
});

test("concurrent duplicate callbacks for the same payment still grant the entitlement at most once", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const { userId, orderId, resourceId, externalPaymentId } = await seedOrder(client, { amountMillimes: 5000 });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => flouciVerifyResponse("SUCCESS", 5000, orderId)) as typeof fetch;

    try {
      await Promise.all([
        verifyAndApplyByExternalId("flouci", externalPaymentId),
        verifyAndApplyByExternalId("flouci", externalPaymentId),
        verifyAndApplyByExternalId("flouci", externalPaymentId),
      ]);

      const purchases = await client.query("select count(*) from purchases where order_id = $1", [orderId]);
      assert.equal(Number(purchases.rows[0].count), 1, "concurrent callbacks must not double-grant the entitlement");
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(client, userId, resourceId);
    }
  });
});

test("a Flouci API failure during verification leaves the order pending and grants nothing", { skip: !url }, async () => {
  await withClient(async (client) => {
    const { verifyAndApplyByExternalId } = await import("../../src/server/services/checkout");
    const { userId, orderId, resourceId, externalPaymentId } = await seedOrder(client, { amountMillimes: 5000 });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("simulated network timeout");
    }) as typeof fetch;

    try {
      await assert.rejects(() => verifyAndApplyByExternalId("flouci", externalPaymentId));

      const order = await client.query("select status from orders where id = $1", [orderId]);
      assert.equal(order.rows[0].status, "pending");

      const purchases = await client.query("select count(*) from purchases where order_id = $1", [orderId]);
      assert.equal(Number(purchases.rows[0].count), 0);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanup(client, userId, resourceId);
    }
  });
});
