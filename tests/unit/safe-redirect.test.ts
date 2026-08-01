import test from "node:test";
import assert from "node:assert/strict";
import { safeAppRedirect } from "../../src/lib/security/safe-redirect";

test("safeAppRedirect keeps locale-scoped application paths", () => {
  assert.equal(safeAppRedirect("/fr/formations?page=2", "fr"), "/fr/formations?page=2");
});

test("safeAppRedirect rejects external and protocol-relative destinations", () => {
  assert.equal(safeAppRedirect("https://evil.example", "fr"), "/fr/dashboard");
  assert.equal(safeAppRedirect("//evil.example/fr/dashboard", "fr"), "/fr/dashboard");
  assert.equal(safeAppRedirect("/ar/dashboard", "fr"), "/fr/dashboard");
});
