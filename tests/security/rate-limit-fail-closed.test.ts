import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeRateLimit,
  requestFingerprint,
  setRateLimitRedisResolverForTests,
} from "@/server/security/rate-limit";

test("rate-limit: normal in-memory fallback limits requests and tracks remaining", async () => {
  const testKey = `test-normal-${Date.now()}`;
  const res1 = await consumeRateLimit(testKey, 2, 60);
  assert.equal(res1.allowed, true);
  assert.equal(res1.remaining, 1);

  const res2 = await consumeRateLimit(testKey, 2, 60);
  assert.equal(res2.allowed, true);
  assert.equal(res2.remaining, 0);

  const res3 = await consumeRateLimit(testKey, 2, 60);
  assert.equal(res3.allowed, false);
  assert.equal(res3.remaining, 0);
  assert.ok(res3.retryAfterSeconds > 0);
});

test("rate-limit: Redis outage with failClosedOnOutage=true immediately denies requests", async () => {
  // Inject mock outage: resolver returns null (simulating no Redis connection)
  setRateLimitRedisResolverForTests(async () => null);

  try {
    const testKey = `test-outage-fail-closed-${Date.now()}`;
    const result = await consumeRateLimit(testKey, 10, 60, { failClosedOnOutage: true });
    assert.equal(result.allowed, false, "Must fail closed on Redis outage when configured");
    assert.equal(result.remaining, 0);
    assert.equal(result.retryAfterSeconds, 60);
  } finally {
    setRateLimitRedisResolverForTests(null);
  }
});

test("rate-limit: Redis outage with throw and failClosedOnOutage=true immediately denies requests", async () => {
  // Inject mock outage: resolver throws an unexpected connection error
  setRateLimitRedisResolverForTests(async () => {
    throw new Error("ECONNREFUSED: Redis cluster unreachable");
  });

  try {
    const testKey = `test-outage-error-fail-closed-${Date.now()}`;
    const result = await consumeRateLimit(testKey, 10, 60, { failClosedOnOutage: true });
    assert.equal(result.allowed, false, "Must fail closed on Redis connection crash");
    assert.equal(result.remaining, 0);
  } finally {
    setRateLimitRedisResolverForTests(null);
  }
});

test("rate-limit: Redis outage with failClosedOnOutage=false falls back gracefully to in-memory", async () => {
  setRateLimitRedisResolverForTests(async () => null);

  try {
    const testKey = `test-outage-fallback-${Date.now()}`;
    const result = await consumeRateLimit(testKey, 5, 60, { fallbackLimit: 3 });
    assert.equal(result.allowed, true, "Must fall back to in-memory when failClosedOnOutage is false");
    assert.equal(result.remaining, 2); // 3 - 1
  } finally {
    setRateLimitRedisResolverForTests(null);
  }
});

test("rate-limit: requestFingerprint produces deterministic SHA-256 hash without plaintext leakage", () => {
  const req1 = new Request("https://anei.tn/api/test", {
    headers: { "user-agent": "Mozilla/5.0 TestBrowser" },
  });
  const req2 = new Request("https://anei.tn/api/test", {
    headers: { "user-agent": "Mozilla/5.0 TestBrowser" },
  });
  const req3 = new Request("https://anei.tn/api/test", {
    headers: { "user-agent": "Mozilla/5.0 DifferentBrowser" },
  });

  const fp1 = requestFingerprint(req1);
  const fp2 = requestFingerprint(req2);
  const fp3 = requestFingerprint(req3);

  assert.equal(fp1, fp2);
  assert.notEqual(fp1, fp3);
  assert.equal(fp1.length, 24);
  assert.match(fp1, /^[0-9a-f]{24}$/);
});
