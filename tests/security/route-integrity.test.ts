import test from "node:test";
import assert from "node:assert/strict";
import { auditAllRoutes } from "@/../scripts/audit-route-handlers";

test("route-integrity: 100% of mutating route handlers enforce origin checks, authorization, and rate limiting", async () => {
  const { total, gaps } = await auditAllRoutes();

  assert.ok(total >= 100, `Expected at least 100 mutating routes, found ${total}`);

  if (gaps.length > 0) {
    const errorDetails = gaps
      .map((gap) => `  - ${gap.file}:\n      ${gap.issues.join("\n      ")}`)
      .join("\n");
    assert.fail(`Found ${gaps.length} route handler(s) with security gaps:\n${errorDetails}`);
  }

  assert.equal(gaps.length, 0, "No mutating route handler may have security gaps");
});
