import test from "node:test";
import assert from "node:assert/strict";
import { TUNISIA_LOCATIONS, TUNISIA_GOVERNORATE_NAMES, getDelegationsForGovernorate, isValidGovernorateDelegation } from "../../src/lib/tunisia/locations";

test("includes exactly the 24 official Tunisian governorates", () => {
  assert.equal(TUNISIA_LOCATIONS.length, 24);
});

test("every governorate has a unique code", () => {
  const codes = TUNISIA_LOCATIONS.map((g) => g.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("every governorate has a non-empty name and at least one delegation", () => {
  for (const gov of TUNISIA_LOCATIONS) {
    assert.ok(gov.nameFr.trim().length > 0, `governorate ${gov.code} has an empty name`);
    assert.ok(gov.delegations.length > 0, `governorate ${gov.nameFr} has no delegations`);
  }
});

test("no duplicate delegation codes across the whole dataset", () => {
  const codes = TUNISIA_LOCATIONS.flatMap((g) => g.delegations.map((d) => d.code));
  assert.equal(new Set(codes).size, codes.length);
});

test("every delegation has a non-empty name", () => {
  for (const gov of TUNISIA_LOCATIONS) {
    for (const del of gov.delegations) {
      assert.ok(del.nameFr.trim().length > 0, `delegation ${del.code} has an empty name`);
    }
  }
});

test("TUNISIA_GOVERNORATE_NAMES mirrors the dataset order", () => {
  assert.deepEqual(TUNISIA_GOVERNORATE_NAMES, TUNISIA_LOCATIONS.map((g) => g.nameFr));
});

test("getDelegationsForGovernorate returns only delegations for that governorate", () => {
  const tunisDelegations = getDelegationsForGovernorate("Tunis").map((d) => d.nameFr);
  assert.ok(tunisDelegations.includes("Carthage"));
  assert.ok(!tunisDelegations.includes("Chebba")); // belongs to Mahdia, not Tunis
});

test("getDelegationsForGovernorate returns an empty array for an unknown governorate", () => {
  assert.deepEqual(getDelegationsForGovernorate("Not A Governorate"), []);
});

test("isValidGovernorateDelegation accepts a real pair and rejects a mismatched one", () => {
  assert.equal(isValidGovernorateDelegation("Tunis", "Carthage"), true);
  assert.equal(isValidGovernorateDelegation("Sidi Bouzid", "La Marsa"), false);
  assert.equal(isValidGovernorateDelegation("Tunis", "La Marsa"), true);
});
