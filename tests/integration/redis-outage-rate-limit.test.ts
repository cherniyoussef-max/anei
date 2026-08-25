import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  consumeRateLimit,
  setRateLimitRedisResolverForTests,
} from "@/server/security/rate-limit";

test("sensitive operations remain tightly bounded when Redis is unavailable", async () => {
  setRateLimitRedisResolverForTests(async () => {
    throw new Error("simulated Redis outage");
  });
  const key = `redis-outage:${crypto.randomUUID()}`;
  try {
    const outcomes = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      outcomes.push(await consumeRateLimit(key, 100, 60, { fallbackLimit: 2 }));
    }
    assert.deepEqual(outcomes.map((result) => result.allowed), [true, true, false, false]);
    assert.equal(outcomes[2].remaining, 0);
    assert.ok(outcomes[2].retryAfterSeconds >= 1);
  } finally {
    setRateLimitRedisResolverForTests(null);
  }
});
