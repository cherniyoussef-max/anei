import test from "node:test";
import assert from "node:assert/strict";
import { isTrustedMutationHeaders, normalizeTrustedOrigins } from "../../src/lib/security/origin-policy";

const trusted = normalizeTrustedOrigins(["http://localhost:3000"]);

test("trusted exact origin is accepted", () => {
  const headers = new Headers({ Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" });
  assert.equal(isTrustedMutationHeaders(headers, trusted), true);
});

test("foreign and sibling same-site browser mutations are rejected", () => {
  assert.equal(
    isTrustedMutationHeaders(
      new Headers({ Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" }),
      trusted,
    ),
    false,
  );
  assert.equal(isTrustedMutationHeaders(new Headers({ "Sec-Fetch-Site": "same-site" }), trusted), false);
});

test("non-browser clients without browser provenance headers are left to authentication", () => {
  assert.equal(isTrustedMutationHeaders(new Headers(), trusted), true);
});
