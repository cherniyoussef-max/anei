import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("auth event model stores safe dimensions and no raw secret fields", async () => {
  const [events, schema] = await Promise.all([
    readFile("src/server/auth/events.ts", "utf8"),
    readFile("src/server/db/schema.ts", "utf8"),
  ]);

  assert.match(events, /safeReasonCode/);
  assert.match(schema, /export const authEvent/);
  assert.equal(events.includes("Authorization"), false, "events module must not log auth headers");
  assert.equal(events.includes("session token"), false, "events module must not log session tokens");
});

test("OTP crypto uses cryptographically secure generators", async () => {
  const source = await readFile("src/server/security/auth-otp-crypto.ts", "utf8");
  assert.match(source, /crypto\.randomInt/);
  assert.equal(source.includes("Math.random"), false);
});
