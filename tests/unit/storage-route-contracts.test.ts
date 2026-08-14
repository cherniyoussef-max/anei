/**
 * The storage routes (src/app/api/resources/[id]/download/route.ts,
 * src/app/api/admin/storage/presign-upload/route.ts) transitively import
 * src/server/auth/session.ts / src/server/auth/admin.ts, guarded by
 * `import "server-only"`, which throws outside a Next.js server context
 * (same constraint documented in tests/unit/flouci-webhook-route.test.ts).
 * Behavioral coverage of the entitlement/signing logic these routes call
 * lives in tests/integration/storage-authorization.test.ts; this file
 * covers the request-handling contract (auth-before-work ordering, no
 * client-controlled object key/destination) via source inspection.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const DOWNLOAD_ROUTE = "src/app/api/resources/[id]/download/route.ts";
const PRESIGN_ROUTE = "src/app/api/admin/storage/presign-upload/route.ts";

test("resource download requires an authenticated session, then entitlement, before any object storage location is touched", async () => {
  const source = await readFile(DOWNLOAD_ROUTE, "utf8");
  const sessionIndex = source.indexOf("getSession()");
  const unauthorizedIndex = source.indexOf('"UNAUTHORIZED"');
  const entitlementIndex = source.indexOf("getPurchasedResourceForDownload(");
  const forbiddenIndex = source.indexOf('"FORBIDDEN"');
  const signIndex = source.indexOf("signedDownloadUrl(");
  assert.ok(sessionIndex > -1 && unauthorizedIndex > -1 && entitlementIndex > -1 && forbiddenIndex > -1 && signIndex > -1);
  assert.ok(sessionIndex < unauthorizedIndex, "an unauthenticated request must be rejected before any DB lookup");
  assert.ok(unauthorizedIndex < entitlementIndex, "entitlement is only ever looked up for an authenticated caller");
  assert.ok(entitlementIndex < forbiddenIndex && forbiddenIndex < signIndex, "a non-entitled request must be rejected before a signed URL can be produced");
});

test("resource download entitlement is scoped to the caller's own session user id, not a client-supplied user id", async () => {
  const source = await readFile(DOWNLOAD_ROUTE, "utf8");
  assert.equal(source.includes("getPurchasedResourceForDownload(session.user.id, entityId)"), true);
});

test("resource download resolves the object key from the DB-backed resource row, never from the request", async () => {
  const source = await readFile(DOWNLOAD_ROUTE, "utf8");
  assert.equal(source.includes("signedDownloadUrl(resource.downloadUrl,"), true);
  assert.equal(/signedDownloadUrl\([^)]*(?:params|request|searchParams)/.test(source), false, "the signed object key must never come from client input");
});

test("resource download validates the route id as a UUID before any DB query", async () => {
  const source = await readFile(DOWNLOAD_ROUTE, "utf8");
  assert.equal(source.includes("idSchema.safeParse(rawId)"), true);
  const parseIndex = source.indexOf("idSchema.safeParse(rawId)");
  const entitlementIndex = source.indexOf("getPurchasedResourceForDownload(");
  assert.ok(parseIndex > -1 && entitlementIndex > -1 && parseIndex < entitlementIndex);
});

test("resource download does not leak internal signing/storage errors to the client", async () => {
  const source = await readFile(DOWNLOAD_ROUTE, "utf8");
  const tryIndex = source.indexOf("try {");
  const catchBlock = source.slice(source.indexOf("} catch {", tryIndex), source.indexOf("}", source.indexOf("} catch {", tryIndex) + 10) + 1);
  assert.equal(catchBlock.includes("FILE_NOT_AVAILABLE"), true);
  assert.equal(/error\.message|error\.stack|String\(error\)/.test(catchBlock), false, "a signing failure must return a generic error code, not internal error detail");
});

test("admin presign-upload enforces trusted origin, then admin session, then rate limiting, before signing", async () => {
  const source = await readFile(PRESIGN_ROUTE, "utf8");
  const originIndex = source.indexOf("isTrustedMutation(request)");
  const sessionIndex = source.indexOf("getAdminSession()");
  const forbiddenIndex = source.indexOf('"FORBIDDEN"');
  const rateIndex = source.indexOf("adminMutationRateLimit(");
  const signIndex = source.indexOf("signedUploadUrl(");
  assert.ok(originIndex > -1 && sessionIndex > -1 && forbiddenIndex > -1 && rateIndex > -1 && signIndex > -1);
  assert.ok(originIndex < sessionIndex, "origin/CSRF check must run before the admin session is even read");
  assert.ok(sessionIndex < forbiddenIndex && forbiddenIndex < rateIndex, "an unauthorized caller must be rejected before rate limiting or signing runs");
  assert.ok(rateIndex < signIndex, "rate limiting must gate every signing call");
});

test("admin presign-upload request body accepts no client-supplied object key or bucket/destination", async () => {
  const source = await readFile(PRESIGN_ROUTE, "utf8");
  const schemaStart = source.indexOf("const schema = z.object({");
  const schemaEnd = source.indexOf("});", schemaStart);
  const schemaBlock = source.slice(schemaStart, schemaEnd);
  assert.ok(schemaStart > -1 && schemaEnd > -1);
  assert.equal(/key|bucket|destination|path/i.test(schemaBlock), false, "the client must never be able to choose the object key or storage destination");
  assert.equal(schemaBlock.includes('category: z.enum(["resource", "course", "avatar", "certificate"])'), true, "upload categories must stay a closed, server-defined set");
});

test("admin presign-upload request body is bounded via readLimitedJson, not an unbounded request.json()", async () => {
  const source = await readFile(PRESIGN_ROUTE, "utf8");
  assert.equal(source.includes("readLimitedJson(request)"), true);
  assert.equal(source.includes("await request.json()"), false);
});
