import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { safeAppRedirect } from "../../src/lib/security/safe-redirect";

const injectionPayloads = ["' OR 1=1 --", "'; DROP TABLE user; --", '" OR "1"="1'];

test("redirect allowlist blocks common open-redirect payloads", () => {
  for (const payload of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])
    assert.equal(safeAppRedirect(payload, "fr"), "/fr/dashboard");
});

test("catalog SQL is built with Drizzle parameter APIs, not raw user SQL", async () => {
  const source = await readFile("src/server/queries/catalog.ts", "utf8");
  assert.equal(source.includes("sql.raw("), false);
  assert.equal(source.includes("ilike("), true);
  for (const payload of injectionPayloads) {
    // The test payload never becomes program text in the query implementation.
    assert.equal(source.includes(payload), false);
  }
});

test("high-risk source primitives remain absent from application code", async () => {
  const files = [
    "src/server/queries/catalog.ts",
    "src/server/services/checkout.ts",
    "src/app/api/progress/route.ts",
    "src/app/api/resources/[id]/download/route.ts",
    "src/modules/admin/queries/admin-users.ts",
    "src/modules/admin/queries/admin-analytics.ts",
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.equal(/\beval\s*\(/.test(source), false, file);
    assert.equal(/new\s+Function\s*\(/.test(source), false, file);
    assert.equal(/child_process/.test(source), false, file);
    assert.equal(/dangerouslySetInnerHTML/.test(source), false, file);
  }
});
