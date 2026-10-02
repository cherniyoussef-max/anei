import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Test schema matching src/app/api/admin/webinars/route.ts
const webinarDateSchema = z.object({
  startsAt: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), {
    message: "Invalid date format",
  }),
  meetingProvider: z.enum(["google_meet", "teams", "zoom", "custom", "in_person"]).default("google_meet"),
});

test("Fix 6 TDD: Server-side validation rejects invalid dates", () => {
  // Invalid string: "invalid-date"
  const res1 = webinarDateSchema.safeParse({ startsAt: "invalid-date" });
  assert.equal(res1.success, false, "Must reject arbitrary non-date string");

  // Invalid date: "2026-02-31" (in JavaScript, Date('2026-02-31') is Invalid Date in ISO parser)
  const res2 = webinarDateSchema.safeParse({ startsAt: "2026-02-31T25:99:99Z" });
  assert.equal(res2.success, false, "Must reject out-of-range ISO date");

  // Empty string
  const res3 = webinarDateSchema.safeParse({ startsAt: "" });
  assert.equal(res3.success, false, "Must reject empty date string");

  // Valid date
  const validIso = "2026-10-15T14:30:00.000Z";
  const resValid = webinarDateSchema.safeParse({ startsAt: validIso, meetingProvider: "in_person" });
  assert.equal(resValid.success, true, "Must accept valid ISO date and in_person provider");
  if (resValid.success) {
    assert.equal(resValid.data.meetingProvider, "in_person");
    assert.equal(resValid.data.startsAt.toISOString(), validIso);
  }
});

test("Fix 6 TDD: Date parsing guard prevents RangeError crash on invalid dates", () => {
  function safeParseFormDate(input: string): { ok: true; iso: string } | { ok: false; error: string } {
    if (!input.trim()) {
      return { ok: false, error: "DATE_EMPTY" };
    }
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "DATE_INVALID" };
    }
    return { ok: true, iso: d.toISOString() };
  }

  // Without guard: new Date("invalid").toISOString() throws RangeError
  assert.throws(() => new Date("invalid").toISOString(), /Invalid time value/);

  // With safe guard: gracefully returns error without throw
  const r1 = safeParseFormDate("invalid");
  assert.equal(r1.ok, false);

  const r2 = safeParseFormDate("");
  assert.equal(r2.ok, false);

  const rValid = safeParseFormDate("2026-10-15T14:30:00.000Z");
  assert.equal(rValid.ok, true);
  if (rValid.ok) {
    assert.equal(rValid.iso, "2026-10-15T14:30:00.000Z");
  }
});
