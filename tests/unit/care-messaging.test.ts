import test from "node:test";
import assert from "node:assert/strict";
import { sanitizePlainText } from "../../src/server/services/care-messaging";

test("sanitizePlainText: removes all HTML tags and script injections", () => {
  const dirty = "<script>alert('xss')</script>Bonjour <b>Docteur</b>, comment va l'enfant ?";
  const clean = sanitizePlainText(dirty);
  assert.equal(clean, "alert('xss')Bonjour Docteur, comment va l'enfant ?");
  assert.ok(!clean.includes("<script>"));
  assert.ok(!clean.includes("<b>"));
});

test("sanitizePlainText: trims leading and trailing whitespace", () => {
  const padded = "   Message avec espaces au début et fin   ";
  assert.equal(sanitizePlainText(padded), "Message avec espaces au début et fin");
});

test("sanitizePlainText: handles Arabic text correctly", () => {
  const arabicHtml = "<p>السلام عليكم، هل يمكن <strong>تعديل</strong> الموعد؟</p>";
  const clean = sanitizePlainText(arabicHtml);
  assert.equal(clean, "السلام عليكم، هل يمكن تعديل الموعد؟");
});

test("sanitizePlainText: returns empty string when only tags and whitespace provided", () => {
  assert.equal(sanitizePlainText("   <div><br><span></span></div>  "), "");
});
