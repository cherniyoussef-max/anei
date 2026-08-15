import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWhatsAppPhone, phonesMatch, displayPhone } from "../../src/server/whatsapp/phone";

test("normalizeWhatsAppPhone: digits-only canonical wa_id form", () => {
  assert.equal(normalizeWhatsAppPhone("+216 20 123 456"), "21620123456");
  assert.equal(normalizeWhatsAppPhone("21620123456"), "21620123456");
  assert.equal(normalizeWhatsAppPhone("+21620123456"), "21620123456");
  assert.equal(normalizeWhatsAppPhone("(216) 20-123-456"), "21620123456");
});

test("normalizeWhatsAppPhone: rejects empty, non-numeric, and implausible values", () => {
  assert.equal(normalizeWhatsAppPhone(null), null);
  assert.equal(normalizeWhatsAppPhone(undefined), null);
  assert.equal(normalizeWhatsAppPhone(""), null);
  assert.equal(normalizeWhatsAppPhone("abc"), null);
  assert.equal(normalizeWhatsAppPhone("+216 20 12 3"), null, "too short");
  assert.equal(normalizeWhatsAppPhone("1".repeat(20)), null, "too long");
  assert.equal(normalizeWhatsAppPhone("12345"), null, "local-only length");
});

test("phonesMatch: equal only when both normalize to the same wa_id", () => {
  assert.equal(phonesMatch("+216 20 123 456", "21620123456"), true);
  assert.equal(phonesMatch("21620123456", "+21620123456"), true);
  assert.equal(phonesMatch("+216 20 123 456", "21620987654"), false);
  assert.equal(phonesMatch(null, "21620123456"), false);
  assert.equal(phonesMatch("+216 20 123 456", null), false);
});

test("displayPhone: human-readable E.164-ish form", () => {
  assert.equal(displayPhone("21620123456"), "+21620123456");
  assert.equal(displayPhone("not-a-number"), null);
  assert.equal(displayPhone(null), null);
});