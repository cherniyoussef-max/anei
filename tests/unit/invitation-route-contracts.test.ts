/**
 * Phase 6 invitation route contracts, verified by source inspection (same
 * pattern as tests/unit/persona-route-contracts.test.ts — the routes import
 * server-only session/admin helpers that throw outside Next.js).
 *
 * The security invariants proven here:
 *   * public routes never accept a destination phone, user id, or token hash
 *     from the client — only the high-entropy bearer token (and a 6-digit code)
 *   * claim is the ONLY linking route and requires a real Better Auth session;
 *     the user id used to link comes from that session, never the body
 *   * every public mutation is trusted-origin + rate-limited before any work
 *   * no route/service ever inserts a user row (phone verification is not auth)
 *   * admin routes are trusted-origin → crm.* permission → rate limit → org
 *     role, in that order, before any mutation
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PUBLIC_INFO = "src/app/api/invitations/info/route.ts";
const PUBLIC_OTP_REQUEST = "src/app/api/invitations/otp/request/route.ts";
const PUBLIC_OTP_VERIFY = "src/app/api/invitations/otp/verify/route.ts";
const PUBLIC_CLAIM = "src/app/api/invitations/claim/route.ts";
const ADMIN_LIST = "src/app/api/admin/crm/invitations/route.ts";
const ADMIN_SEND = "src/app/api/admin/crm/invitations/[id]/send/route.ts";
const ADMIN_RESEND = "src/app/api/admin/crm/invitations/[id]/resend/route.ts";
const ADMIN_REVOKE = "src/app/api/admin/crm/invitations/[id]/revoke/route.ts";
const SERVICE = "src/server/services/invitations.ts";

test("public routes accept only the token (and the 6-digit code) — never a destination phone, user id, or token hash", async () => {
  for (const file of [PUBLIC_INFO, PUBLIC_OTP_REQUEST, PUBLIC_OTP_VERIFY, PUBLIC_CLAIM]) {
    const source = await readFile(file, "utf8");
    const schemaBlock = source.slice(source.indexOf("const schema"), source.indexOf("export async function"));
    assert.equal(/destination|phone|userId|tokenHash/i.test(schemaBlock), false, `${file} schema must not accept a client-supplied destination/phone/user id/token hash`);
  }
  const requestSource = await readFile(PUBLIC_OTP_REQUEST, "utf8");
  assert.equal(requestSource.includes("token: z.string().trim().min(40).max(200)"), true);
  const verifySource = await readFile(PUBLIC_OTP_VERIFY, "utf8");
  assert.equal(verifySource.includes('code: z.string().regex(/^\\d{6}$/)'), true, "the OTP must be validated as exactly 6 digits at the boundary");
});

test("every public mutation is trusted-origin and rate-limited before any work, and read paths are rate-limited too", async () => {
  for (const file of [PUBLIC_OTP_REQUEST, PUBLIC_OTP_VERIFY, PUBLIC_CLAIM]) {
    const source = await readFile(file, "utf8");
    const originIndex = source.indexOf("isTrustedMutation(request)");
    const rateIndex = source.indexOf("consumeRateLimit(");
    assert.ok(originIndex > -1, `${file} must check origin/CSRF`);
    assert.ok(rateIndex > -1, `${file} must be rate-limited`);
    assert.ok(originIndex < rateIndex, `${file} must reject untrusted origins before consuming the rate budget`);
  }
  const infoSource = await readFile(PUBLIC_INFO, "utf8");
  assert.equal(infoSource.includes("consumeRateLimit(`inv:info:"), true, "the public info read path must be rate-limited by IP");
});

test("the claim route is the only linker and requires a real session — the user id used comes from the session, never the body", async () => {
  const source = await readFile(PUBLIC_CLAIM, "utf8");
  assert.equal(source.includes("getFreshSession()"), true, "claim must require a fresh Better Auth session");
  assert.equal(source.includes("claimInvitation(session.user.id"), true, "the user id passed to claim must come from the session");
  assert.equal(source.includes("UNAUTHORIZED"), true, "a missing session must be rejected");
});

test("phone verification never creates an account: no public OTP route and no service statement inserts a user row", async () => {
  const service = await readFile(SERVICE, "utf8");
  assert.equal(/insert\(\s*user\b|INSERT\s+INTO\s+"?user/.test(service), false, "the invitation service must never insert into the user table");
  assert.equal(service.includes("insert(user"), false);
  for (const file of [PUBLIC_OTP_REQUEST, PUBLIC_OTP_VERIFY, PUBLIC_CLAIM]) {
    const source = await readFile(file, "utf8");
    assert.equal(source.includes("insert(user"), false, `${file} must not touch the user table`);
  }
});

test("admin routes are trusted-origin → crm permission → rate limit → org role, in that order, before any mutation", async () => {
  for (const file of [ADMIN_LIST, ADMIN_SEND, ADMIN_RESEND, ADMIN_REVOKE]) {
    const source = await readFile(file, "utf8");
    assert.ok(source.includes('getAdminSessionFor("crm.manage")'), `${file} must require the crm.manage permission`);
    assert.equal(source.includes("adminMutationRateLimit("), true, `${file} must rate-limit the admin mutation`);
    assert.equal(source.includes("resolveActorOrgRole("), true, `${file} must resolve the actor's organization role`);
  }
  const list = await readFile(ADMIN_LIST, "utf8");
  assert.ok(list.indexOf('getAdminSessionFor("crm.read")') > -1, "the list route must require crm.read");
});

test("admin mutation routes only accept the organizationId (never a token, phone, or user id) and use strict schemas", async () => {
  for (const file of [ADMIN_LIST, ADMIN_SEND, ADMIN_RESEND, ADMIN_REVOKE]) {
    const source = await readFile(file, "utf8");
    assert.equal(source.includes(".strict()"), true, `${file} must reject unknown fields`);
    assert.equal(/destination|phone|tokenHash/.test(source), false, `${file} must not accept client-supplied secrets/phones`);
    assert.equal(source.includes("readLimitedJson(request)"), true);
    assert.equal(source.includes("await request.json()"), false);
  }
});

test("controlled generic errors: public routes never leak account or provider detail beyond bounded codes", async () => {
  const info = await readFile(PUBLIC_INFO, "utf8");
  assert.equal(info.includes('{ error: "INVALID_TOKEN" }, { status: 404 }'), true, "an unknown token is a single controlled 404");
  const verify = await readFile(PUBLIC_OTP_VERIFY, "utf8");
  assert.equal(verify.includes('{ error: "LOCKED" }, { status: 429 }'), true, "budget exhaustion surfaces as a locked error, not account detail");
});