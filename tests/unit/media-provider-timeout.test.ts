import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Cloudflare Stream token fetch is bounded by an explicit timeout, matching every other outbound provider call", async () => {
  const source = await readFile("src/server/media/cloudflare-stream.ts", "utf8");
  const fetchCallStart = source.indexOf("await fetch(");
  assert.ok(fetchCallStart > -1, "expected a fetch() call to the Cloudflare Stream token endpoint");
  const fetchCallEnd = source.indexOf(");", fetchCallStart);
  const fetchCall = source.slice(fetchCallStart, fetchCallEnd);
  assert.equal(fetchCall.includes("signal: AbortSignal.timeout("), true, "the request must not be able to hang indefinitely on a Cloudflare outage");

  // A generic error must reach callers either way, so a timeout can't leak provider internals.
  assert.equal(source.includes('throw new MediaProviderError("STREAM_TOKEN_REQUEST_FAILED")'), true);
});
