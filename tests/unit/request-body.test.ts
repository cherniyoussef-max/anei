import test from "node:test";
import assert from "node:assert/strict";
import { readLimitedJson, readLimitedRawBody, RequestBodyTooLargeError } from "../../src/server/security/request-body";

test("readLimitedJson accepts bounded JSON", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "ANEI" }),
  });
  assert.deepEqual(await readLimitedJson(request, 1024), { name: "ANEI" });
});

test("readLimitedJson stops oversized streamed bodies", async () => {
  const payload = JSON.stringify({ body: "x".repeat(4096) });
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
  await assert.rejects(() => readLimitedJson(request, 256), RequestBodyTooLargeError);
});

test("readLimitedRawBody returns the exact received bytes for signature computation", async () => {
  const payload = JSON.stringify({ object: "whatsapp_business_account", foo: "bar" });
  const request = new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
  const raw = await readLimitedRawBody(request, 1024);
  assert.equal(raw.toString("utf8"), payload);
});

test("readLimitedRawBody rejects oversized bodies even without a trustworthy Content-Length", async () => {
  const payload = JSON.stringify({ body: "y".repeat(4096) });
  const request = new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
  await assert.rejects(() => readLimitedRawBody(request, 256), RequestBodyTooLargeError);
});

test("readLimitedRawBody rejects a declared Content-Length above the ceiling", async () => {
  const request = new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "999999" },
    body: JSON.stringify({ a: 1 }),
  });
  await assert.rejects(() => readLimitedRawBody(request, 1024), RequestBodyTooLargeError);
});

test("readLimitedRawBody returns an empty buffer for a bodyless request", async () => {
  const request = new Request("http://localhost/api/webhooks/whatsapp", { method: "POST" });
  const raw = await readLimitedRawBody(request, 1024);
  assert.equal(raw.length, 0);
});
