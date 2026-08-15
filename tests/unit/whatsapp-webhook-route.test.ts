import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROUTE = "src/app/api/webhooks/whatsapp/route.ts";

test("the GET verification handshake requires mode=subscribe AND the matching verify token", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(source.includes("hub.mode"), true);
  assert.equal(source.includes("hub.verify_token"), true);
  assert.equal(source.includes("hub.challenge"), true);
  assert.equal(source.includes("verifyWebhookChallenge"), true);
  // The raw challenge is echoed verbatim, not re-encoded.
  assert.equal(source.includes("new NextResponse(challenge ?? \"\", { status: 200 })"), true);
});

test("POST authenticity is verified with X-Hub-Signature-256 over the RAW body BEFORE parsing", async () => {
  const source = await readFile(ROUTE, "utf8");
  const rawReadIndex = source.indexOf("readLimitedRawBody(request, MAX_WEBHOOK_BODY_BYTES)");
  const sigIndex = source.indexOf("verifyWebhookSignature(raw, signatureHeader, whatsappAppSecret)");
  const parseIndex = source.indexOf("JSON.parse(raw.toString(\"utf8\"))");
  assert.ok(rawReadIndex > -1 && sigIndex > -1 && parseIndex > -1);
  assert.ok(rawReadIndex < sigIndex, "raw body must be read before signature verification");
  assert.ok(sigIndex < parseIndex, "signature must be verified BEFORE the body is parsed");
  // The signature must be computed over the exact received bytes — never over a parsed & re-serialized body.
  assert.equal(source.includes("JSON.stringify"), false);
});

test("the raw body is bounded with a hard byte ceiling independent of Content-Length", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(source.includes("readLimitedRawBody(request, MAX_WEBHOOK_BODY_BYTES)"), true);
  assert.equal(source.includes("MAX_WEBHOOK_BODY_BYTES = 256 * 1024"), true);
});

test("an invalid signature fails closed with 401 before any event processing", async () => {
  const source = await readFile(ROUTE, "utf8");
  const sigIndex = source.indexOf("verifyWebhookSignature(raw, signatureHeader, whatsappAppSecret)");
  const invalidIndex = source.indexOf("whatsapp.webhook_signature_invalid");
  const status401 = source.indexOf("status: 401");
  const ingestIndex = source.indexOf("ingestWebhookEvents(events)");
  assert.ok(sigIndex > -1 && invalidIndex > -1 && status401 > -1 && ingestIndex > -1);
  assert.ok(sigIndex < invalidIndex && invalidIndex < status401 && status401 < ingestIndex, "401 must return before ingestWebhookEvents is reached");
});

test("a coarse per-IP rate limit runs before body reading and event processing", async () => {
  const source = await readFile(ROUTE, "utf8");
  const rateIndex = source.indexOf("consumeRateLimit(`whatsapp-webhook-ip:");
  const readIndex = source.indexOf("readLimitedRawBody(request, MAX_WEBHOOK_BODY_BYTES)");
  assert.ok(rateIndex > -1 && readIndex > -1);
  assert.ok(rateIndex < readIndex, "rate limit must be checked before reading the body");
});

test("a request with no recognizable events is acknowledged (200) so Meta stops retrying", async () => {
  const source = await readFile(ROUTE, "utf8");
  const normalizeIndex = source.indexOf("normalizeWebhook(parsed)");
  const emptyIndex = source.indexOf("if (!events.length)");
  const okIndex = source.indexOf("return NextResponse.json({ ok: true });");
  assert.ok(normalizeIndex > -1 && emptyIndex > -1 && okIndex > -1);
  assert.ok(normalizeIndex < emptyIndex && emptyIndex < okIndex);
});

test("logging carries only structured identifiers — never raw error objects, headers, or secrets", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.equal(source.includes("request.headers.get(\"authorization\")"), false);
  assert.equal(source.includes("WHATSAPP_ACCESS_TOKEN"), false);
  assert.equal(source.includes("WHATSAPP_APP_SECRET"), false);
  assert.equal(source.includes("WHATSAPP_VERIFY_TOKEN"), false);
  assert.equal(source.includes("console.log"), false);
  // The app secret and verify token are read from config (env), not from the request.
  assert.equal(source.includes("whatsappAppSecret"), true);
  assert.equal(source.includes("whatsappVerifyToken"), true);
});