import test from "node:test";
import assert from "node:assert/strict";
import { readLimitedJson, RequestBodyTooLargeError } from "../../src/server/security/request-body";

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
