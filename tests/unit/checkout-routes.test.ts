/**
 * The checkout routes (src/app/api/payments/create/route.ts,
 * src/app/api/payments/verify/route.ts) transitively import
 * src/server/auth/session.ts, guarded by `import "server-only"`, which
 * throws outside a Next.js server context (same constraint documented in
 * tests/unit/flouci-webhook-route.test.ts). Behavioral coverage of the
 * service layer these routes call lives in
 * tests/integration/checkout-service.test.ts; this file covers the
 * request-handling contract (auth-before-work ordering, price authority)
 * via source inspection.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CREATE_ROUTE = "src/app/api/payments/create/route.ts";
const VERIFY_ROUTE = "src/app/api/payments/verify/route.ts";

test("checkout creation requires an authenticated session before any order/payment work runs", async () => {
  const source = await readFile(CREATE_ROUTE, "utf8");
  const originIndex = source.indexOf("isTrustedMutation(request)");
  const sessionIndex = source.indexOf("getSession()");
  const unauthorizedIndex = source.indexOf('"UNAUTHORIZED"');
  const checkoutIndex = source.indexOf("createOrderCheckout(");
  assert.ok(originIndex > -1 && sessionIndex > -1 && unauthorizedIndex > -1 && checkoutIndex > -1);
  assert.ok(originIndex < sessionIndex, "origin/CSRF check must run before session is even read");
  assert.ok(sessionIndex < unauthorizedIndex && unauthorizedIndex < checkoutIndex, "an unauthenticated request must be rejected before any checkout is created");
});

test("the checkout request body accepts no client-supplied amount/price field; price authority stays server-side", async () => {
  const source = await readFile(CREATE_ROUTE, "utf8");
  const schemaStart = source.indexOf("const bodySchema = z.object({");
  const schemaEnd = source.indexOf("});", schemaStart);
  const schemaBlock = source.slice(schemaStart, schemaEnd);
  assert.ok(schemaStart > -1 && schemaEnd > -1);
  assert.equal(/amount|price|millimes/i.test(schemaBlock), false, "the checkout body schema must never accept a client-supplied amount");
  // createOrderCheckout resolves price from the DB item, not from the request:
  assert.equal(source.includes("createOrderCheckout({"), true);
  assert.equal(/amountMillimes:\s*parsed\.data/.test(source), false);
});

test("checkout creation is rate-limited per authenticated user before touching order/payment state", async () => {
  const source = await readFile(CREATE_ROUTE, "utf8");
  const rateIndex = source.indexOf("consumeRateLimit(`checkout:");
  const checkoutIndex = source.indexOf("createOrderCheckout(");
  assert.ok(rateIndex > -1 && checkoutIndex > -1 && rateIndex < checkoutIndex);
});

test("payment verification requires an authenticated session and only ever looks up the caller's own order", async () => {
  const source = await readFile(VERIFY_ROUTE, "utf8");
  const sessionIndex = source.indexOf("getSession()");
  const unauthorizedIndex = source.indexOf('"UNAUTHORIZED"');
  const scopedLookupIndex = source.indexOf("eq(orders.userId, session.user.id)");
  assert.ok(sessionIndex > -1 && unauthorizedIndex > -1 && scopedLookupIndex > -1);
  assert.ok(sessionIndex < unauthorizedIndex && unauthorizedIndex < scopedLookupIndex);
});

test("payment verification never trusts a client-supplied status; it always re-derives status from verifyAndApplyPayment", async () => {
  const source = await readFile(VERIFY_ROUTE, "utf8");
  assert.equal(source.includes("verifyAndApplyPayment(row.payment.id)"), true);
  const schema = source.slice(source.indexOf("const schema = z.object({"), source.indexOf("});", source.indexOf("const schema = z.object({")));
  assert.equal(/status/i.test(schema), false, "the verify request body must never accept a client-declared status");
});
