import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTunisiaPhone, isValidTunisiaPhone, extractNationalDigits, formatNationalDigits } from "../../src/lib/tunisia/phone";

test("normalizes a bare 8-digit local number to +216XXXXXXXX", () => {
  assert.equal(normalizeTunisiaPhone("20311900"), "+21620311900");
});

test("normalizes a spaced local number to +216XXXXXXXX", () => {
  assert.equal(normalizeTunisiaPhone("20 311 900"), "+21620311900");
});

test("normalizes an already-prefixed +216 number", () => {
  assert.equal(normalizeTunisiaPhone("+21620311900"), "+21620311900");
});

test("normalizes a 216-prefixed number without the leading +", () => {
  assert.equal(normalizeTunisiaPhone("21620311900"), "+21620311900");
});

for (const bad of ["", "123", "2031190", "203119000", "20abcdef", "+216+21620311900", "+2162031190", "0020311900"]) {
  test(`rejects malformed phone: ${JSON.stringify(bad)}`, () => {
    assert.equal(normalizeTunisiaPhone(bad), null);
    assert.equal(isValidTunisiaPhone(bad), false);
  });
}

test("extractNationalDigits strips prefix/spaces and bounds to 8 digits", () => {
  assert.equal(extractNationalDigits("+216 20 311 900"), "20311900");
  assert.equal(extractNationalDigits("20 311 9000000"), "20311900");
  assert.equal(extractNationalDigits("2031-1900"), "20311900");
});

test("formatNationalDigits groups as 2-3-3", () => {
  assert.equal(formatNationalDigits("20311900"), "20 311 900");
  assert.equal(formatNationalDigits("203"), "20 3");
  assert.equal(formatNationalDigits(""), "");
});
