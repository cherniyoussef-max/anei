import test from "node:test";
import assert from "node:assert/strict";
import { canApplyMessageStatus, type WhatsAppMessageStatus } from "../../src/modules/whatsapp/domain/permissions";

test("status precedence is strictly monotonic forward (QUEUED < SENT < DELIVERED < READ)", () => {
  const order: WhatsAppMessageStatus[] = ["QUEUED", "SENT", "DELIVERED", "READ"];
  for (let i = 0; i < order.length; i += 1) {
    for (let j = 0; j < order.length; j += 1) {
      if (j > i) assert.equal(canApplyMessageStatus(order[i], order[j]), true, `${order[i]} -> ${order[j]}`);
      else assert.equal(canApplyMessageStatus(order[i], order[j]), false, `${order[i]} -> ${order[j]} must not regress`);
    }
  }
});

test("FAILED is terminal and only reachable before delivery", () => {
  assert.equal(canApplyMessageStatus("QUEUED", "FAILED"), true);
  assert.equal(canApplyMessageStatus("SENT", "FAILED"), true);
  assert.equal(canApplyMessageStatus("DELIVERED", "FAILED"), false, "a delivered message must never flip to FAILED");
  assert.equal(canApplyMessageStatus("READ", "FAILED"), false, "a read message must never flip to FAILED");
  for (const status of ["QUEUED", "SENT", "DELIVERED", "READ"] as const) {
    assert.equal(canApplyMessageStatus("FAILED", status), false, `FAILED -> ${status} must never resurrect`);
  }
  assert.equal(canApplyMessageStatus("FAILED", "FAILED"), false);
});

test("an identical status is never re-applied (replay-safe)", () => {
  assert.equal(canApplyMessageStatus("DELIVERED", "DELIVERED"), false);
  assert.equal(canApplyMessageStatus("SENT", "SENT"), false);
  assert.equal(canApplyMessageStatus("READ", "READ"), false);
});