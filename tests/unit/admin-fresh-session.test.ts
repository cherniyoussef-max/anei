import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("getFreshSession bypasses Better Auth's cookieCache via disableCookieCache", async () => {
  const source = await readFile("src/server/auth/session.ts", "utf8");
  assert.equal(source.includes("export const getFreshSession = cache(async"), true);
  assert.equal(source.includes("query: { disableCookieCache: true }"), true);
  // Request-scoped memoization keeps an admin layout + page from doubling the DB hit.
  assert.equal(source.includes('import { cache } from "react"'), true);
});

test("every admin authorization path reads the fresh (non-cached) session", async () => {
  const [sessionSource, adminSource] = await Promise.all([
    readFile("src/server/auth/session.ts", "utf8"),
    readFile("src/server/auth/admin.ts", "utf8"),
  ]);

  assert.equal(adminSource.includes('import { getFreshSession } from "@/server/auth/session"'), true);
  assert.equal(adminSource.includes("getSession"), false, "admin.ts must not import the cookie-cached getSession");

  const adminFns = ["getAdminSession", "getSuperAdminSession", "getAdminSessionFor"];
  for (const fn of adminFns) {
    const start = adminSource.indexOf(`export async function ${fn}`);
    assert.ok(start > -1, `${fn} not found`);
    const body = adminSource.slice(start, start + 200);
    assert.equal(body.includes("getFreshSession()"), true, `${fn} must call getFreshSession()`);
  }

  for (const fn of ["requireAdmin", "requireAdminPermission"]) {
    const start = sessionSource.indexOf(`export async function ${fn}`);
    assert.ok(start > -1, `${fn} not found`);
    const body = sessionSource.slice(start, start + 300);
    assert.equal(body.includes("getFreshSession()"), true, `${fn} must call getFreshSession()`);
  }
});

test("normal learner session lookup keeps using Better Auth's cookieCache and assurance gate", async () => {
  const source = await readFile("src/server/auth/session.ts", "utf8");
  const getSessionStart = source.indexOf("export async function getSession()");
  const getSessionBody = source.slice(getSessionStart, getSessionStart + 150);
  assert.equal(getSessionBody.includes("disableCookieCache"), false);

  const requireUserStart = source.indexOf("export async function requireUser");
  const requireUserBody = source.slice(requireUserStart, requireUserStart + 260);
  assert.equal(requireUserBody.includes("getSessionWithAssurance()"), true, "requireUser must enforce session assurance for protected access");
});

test("session revocation is documented as defense-in-depth, not required for authorization correctness", async () => {
  const source = await readFile("src/server/auth/session.ts", "utf8");
  const start = source.indexOf("export async function revokeUserSessions");
  const commentStart = source.lastIndexOf("/**", start);
  const doc = source.slice(commentStart, start);
  assert.match(doc, /internal/i);
  assert.match(doc, /defense in depth/i);
  assert.equal(doc.includes("getFreshSession()"), true);
});
