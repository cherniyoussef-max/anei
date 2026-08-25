import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("signup captures a bounded referral before an immediately active persona can reward it", async () => {
  const [authSource, serviceSource] = await Promise.all([
    readFile("src/server/auth/index.ts", "utf8"),
    readFile("src/server/services/referrals.ts", "utf8"),
  ]);
  const capture = authSource.indexOf("await captureReferralAtSignup");
  const membership = authSource.indexOf("await ensurePrimaryPersonaMembership", capture);
  assert.equal(capture >= 0 && membership > capture, true);
  assert.equal(serviceSource.includes("{4,64}"), true);
  assert.equal(serviceSource.includes("ownerCode.userId === referredUserId"), true);
  assert.equal(serviceSource.includes("onConflictDoNothing"), true);
});
