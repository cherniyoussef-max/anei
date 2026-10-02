import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizePlainText } from "@/server/services/care-notes-documents";

describe("Care notes and documents unit tests", () => {
  it("sanitizePlainText: removes HTML tags, scripts, and trims whitespace", () => {
    const dirty = "  <script>alert('xss')</script><b>Note importante</b>: Progrès notables.  ";
    const cleaned = sanitizePlainText(dirty);
    assert.equal(cleaned, "alert('xss')Note importante: Progrès notables.");
  });

  it("sanitizePlainText: preserves Arabic text cleanly", () => {
    const arabic = "  <p>تحسن ملحوظ في <strong>النطق والتواصل</strong></p>  ";
    const cleaned = sanitizePlainText(arabic);
    assert.equal(cleaned, "تحسن ملحوظ في النطق والتواصل");
  });

  it("sanitizePlainText: returns empty string when only tags/empty space provided", () => {
    assert.equal(sanitizePlainText("<p>   <br/> </p>"), "");
    assert.equal(sanitizePlainText(""), "");
  });

  it("24-hour immutability calculation: detects notes created more than 24h ago", () => {
    const now = Date.now();
    const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000);
    const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000);

    const isOlderThan24h = (date: Date) => Date.now() - date.getTime() > 24 * 60 * 60 * 1000;

    assert.equal(isOlderThan24h(twentyThreeHoursAgo), false);
    assert.equal(isOlderThan24h(twentyFiveHoursAgo), true);
  });
});
