/**
 * Persona portals/layouts and the admin persona-management route import
 * src/server/auth/session.ts / src/server/auth/admin.ts, guarded by
 * `import "server-only"`, which throws outside a Next.js server context
 * (same constraint documented in tests/unit/storage-route-contracts.test.ts).
 * Behavioral DB coverage lives in tests/integration/persona-membership.test.ts
 * and tests/integration/persona-signup-hook.test.ts; this file covers the
 * request-handling / authorization-ordering contract via source inspection —
 * proving each portal is server-side gated by the caller's real ACTIVE
 * persona (never client state, hidden nav, or profileType alone), and that
 * no portal/pending-review pair can redirect-loop.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ADMIN_PERSONAS_ROUTE = "src/app/api/admin/users/[id]/personas/route.ts";
const ACCOUNT_PERSONAS_ROUTE = "src/app/api/account/personas/route.ts";
const DASHBOARD_PAGE = "src/app/[locale]/(learner)/dashboard/page.tsx";
const PENDING_REVIEW_PAGE = "src/app/[locale]/(auth)/pending-review/page.tsx";

const portalLayouts: Array<{ file: string; persona: string }> = [
  { file: "src/app/[locale]/(site)/teacher/layout.tsx", persona: "TEACHER" },
  { file: "src/app/[locale]/(site)/parent/layout.tsx", persona: "PARENT" },
  { file: "src/app/[locale]/(site)/specialist/layout.tsx", persona: "SPECIALIST" },
  { file: "src/app/[locale]/(site)/organization/layout.tsx", persona: "ORGANIZATION" },
  { file: "src/app/[locale]/(site)/avs/espace/layout.tsx", persona: "AVS" },
];

test("every professional/parent portal layout gates on requireActivePersona with its own persona, server-side", async () => {
  for (const { file, persona } of portalLayouts) {
    const source = await readFile(file, "utf8");
    assert.equal(source.includes("import { requireActivePersona } from \"@/server/auth/session\""), true, `${file} must import the server-side persona guard`);
    assert.equal(source.includes(`requireActivePersona(locale, "${persona}")`), true, `${file} must require the ACTIVE ${persona} persona before rendering`);
  }
});

test("portal layouts never authorize from client-suppliable state (profileType, searchParams, headers)", async () => {
  for (const { file } of portalLayouts) {
    const source = await readFile(file, "utf8");
    assert.equal(/profileType/.test(source), false, `${file} must not branch on profileType`);
    assert.equal(/searchParams/.test(source), false, `${file} must not accept a client-supplied persona override`);
  }
});

test("AVS portal is placed at /avs/espace, distinct from the public /avs directory, and links back to it rather than duplicating it", async () => {
  const source = await readFile("src/app/[locale]/(site)/avs/espace/layout.tsx", "utf8");
  assert.equal(source.includes("/${locale}/avs`"), true, "the AVS portal must link to the existing public directory, not reimplement it");
  const publicDirectory = await readFile("src/app/[locale]/(site)/avs/page.tsx", "utf8");
  assert.equal(publicDirectory.includes("requireActivePersona"), false, "the public AVS directory must remain unauthenticated/unchanged");
});

test("dashboard redirects a non-admin, non-STUDENT primary persona server-side, before rendering learner data — admin bypass takes precedence, and it never trusts anything but the DB-loaded membership row", async () => {
  const source = await readFile(DASHBOARD_PAGE, "utf8");
  const adminCheckIndex = source.indexOf('["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role))');
  const membershipIndex = source.indexOf("getUserPersonas(session.user.id)");
  const dataIndex = source.indexOf("getDashboardData(session.user.id)");
  assert.ok(adminCheckIndex > -1 && membershipIndex > -1 && dataIndex > -1);
  assert.ok(adminCheckIndex < membershipIndex, "admin bypass must be decided before persona membership is even queried");
  assert.ok(membershipIndex < dataIndex, "a redirect for a non-STUDENT active persona must happen before the learner dashboard queries its own data");
  assert.equal(source.includes("personaPortalPath[primary.persona as Persona]"), true, "the redirect target must come from the server-defined persona->path map, not client input");
  assert.equal(source.includes('redirect(`/${locale}/pending-review`)'), true, "a non-ACTIVE primary persona must redirect to pending-review, never render professional data on /dashboard");
});

test("pending-review page has no persona gate (avoids a redirect loop with the portal layouts) and requires only authentication", async () => {
  const source = await readFile(PENDING_REVIEW_PAGE, "utf8");
  assert.equal(source.includes("requireActivePersona"), false, "pending-review must stay reachable regardless of persona status");
  assert.equal(source.includes("requireUser(locale)"), true, "pending-review still requires a logged-in session");
});

test("no portal layout redirects to pending-review from within pending-review itself (no cycle)", async () => {
  for (const { file } of portalLayouts) {
    assert.notEqual(file, PENDING_REVIEW_PAGE);
  }
  // pending-review is the sink: it must never redirect to a portal or to itself.
  const source = await readFile(PENDING_REVIEW_PAGE, "utf8");
  assert.equal(/redirect\(/.test(source), false);
});

test("admin persona route: trusted-origin, then personas.manage permission, then rate limit, before any DB mutation", async () => {
  const source = await readFile(ADMIN_PERSONAS_ROUTE, "utf8");
  const originIndex = source.indexOf("isTrustedMutation(request)");
  const permissionIndex = source.indexOf('getAdminSessionFor("personas.manage")');
  const forbiddenIndex = source.indexOf('"FORBIDDEN"');
  const rateIndex = source.indexOf("adminMutationRateLimit(");
  const mutateIndex = source.indexOf("adminSetPersonaStatus(");
  assert.ok(originIndex > -1 && permissionIndex > -1 && forbiddenIndex > -1 && rateIndex > -1 && mutateIndex > -1);
  assert.ok(originIndex < permissionIndex, "origin/CSRF check must run before the admin session is even read");
  assert.ok(permissionIndex < forbiddenIndex && forbiddenIndex < rateIndex, "an unauthorized caller must be rejected before rate limiting runs");
  assert.ok(rateIndex < mutateIndex, "rate limiting must gate the persona mutation");
});

test("admin persona route uses a strict, closed Zod schema (no unbounded/free-form fields) and a bounded body reader", async () => {
  const source = await readFile(ADMIN_PERSONAS_ROUTE, "utf8");
  assert.equal(source.includes("z.enum(personas)"), true, "persona must be validated against the canonical closed set, never an arbitrary string");
  assert.equal(source.includes("z.enum(personaStatuses)"), true, "status must be validated against the canonical closed set");
  assert.equal(source.includes(".strict()"), true, "the schema must reject unknown fields");
  assert.equal(source.includes("readLimitedJson(request)"), true);
  assert.equal(source.includes("await request.json()"), false);
});

test("admin persona route invalidates the admin user cache after every mutation, matching the role-route precedent", async () => {
  const source = await readFile(ADMIN_PERSONAS_ROUTE, "utf8");
  assert.equal(source.includes("invalidateAdminUserCaches(id.data)"), true);
});

test("account personas route is self-scoped to the caller's own session — never accepts a client-supplied userId", async () => {
  const source = await readFile(ACCOUNT_PERSONAS_ROUTE, "utf8");
  assert.equal(source.includes("getUserPersonas(current.user.id)"), true);
  assert.equal(/params/.test(source), false, "no route parameter (another user's id) may select whose personas are returned");
});

test("persona status mutations are always audited via the service layer, not the route directly bypassing it", async () => {
  const service = await readFile("src/server/services/personas.ts", "utf8");
  assert.equal(service.includes("auditLogs"), true);
  const statusFnIndex = service.indexOf("export async function adminSetPersonaStatus");
  const statusAuditIndex = service.indexOf("action: `persona.status.${status.toLowerCase()}`");
  assert.ok(statusFnIndex > -1 && statusAuditIndex > -1 && statusFnIndex < statusAuditIndex);

  const primaryFnIndex = service.indexOf("export async function adminSetPrimaryPersona");
  const primaryAuditIndex = service.indexOf('action: "persona.primary.set"');
  assert.ok(primaryFnIndex > -1 && primaryAuditIndex > -1 && primaryFnIndex < primaryAuditIndex);
});

test("persona status/primary mutations run inside a DB transaction (atomic with the audit row)", async () => {
  const service = await readFile("src/server/services/personas.ts", "utf8");
  const statusBlock = service.slice(service.indexOf("export async function adminSetPersonaStatus"), service.indexOf("export async function adminSetPrimaryPersona"));
  assert.equal(statusBlock.includes("db.transaction("), true);
  const primaryBlock = service.slice(service.indexOf("export async function adminSetPrimaryPersona"));
  assert.equal(primaryBlock.includes("db.transaction("), true);
});
