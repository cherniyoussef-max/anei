import test from "node:test";
import assert from "node:assert/strict";
import { resolveUserHomePath, safeAppRedirect } from "../../src/lib/security/safe-redirect";

test("safeAppRedirect keeps locale-scoped application paths", () => {
  assert.equal(safeAppRedirect("/fr/formations?page=2", "fr"), "/fr/formations?page=2");
});

test("safeAppRedirect rejects external and protocol-relative destinations", () => {
  assert.equal(safeAppRedirect("https://evil.example", "fr"), "/fr/dashboard");
  assert.equal(safeAppRedirect("//evil.example/fr/dashboard", "fr"), "/fr/dashboard");
  assert.equal(safeAppRedirect("/ar/dashboard", "fr"), "/fr/dashboard");
});

test("resolveUserHomePath prioritizes valid explicitNext", () => {
  assert.equal(
    resolveUserHomePath("fr", { role: "USER", primaryPersona: "PARENT" }, "/fr/formations/neuro-education"),
    "/fr/formations/neuro-education",
  );
  // Ignores generic /dashboard fallback if user is PARENT
  assert.equal(
    resolveUserHomePath("fr", { role: "USER", primaryPersona: "PARENT" }, "/fr/dashboard"),
    "/fr/parent",
  );
  // Rejects open-redirect payload
  assert.equal(
    resolveUserHomePath("fr", { role: "USER", primaryPersona: "PARENT" }, "https://attacker.example"),
    "/fr/parent",
  );
});

test("resolveUserHomePath routes admins to /admin unless previewing learner space", () => {
  assert.equal(
    resolveUserHomePath("fr", { role: "ADMIN", primaryPersona: "STUDENT" }),
    "/fr/admin",
  );
  assert.equal(
    resolveUserHomePath("fr", { role: "SUPER_ADMIN", primaryPersona: "STUDENT" }),
    "/fr/admin",
  );
  assert.equal(
    resolveUserHomePath("fr", { role: "ADMIN", primaryPersona: "STUDENT" }, null, "learner"),
    "/fr/dashboard",
  );
});

test("resolveUserHomePath routes all canonical personas in FR and AR", () => {
  assert.equal(resolveUserHomePath("fr", { role: "USER", primaryPersona: "PARENT" }), "/fr/parent");
  assert.equal(resolveUserHomePath("ar", { role: "USER", primaryPersona: "PARENT" }), "/ar/parent");
  assert.equal(resolveUserHomePath("fr", { role: "USER", primaryPersona: "TEACHER" }), "/fr/teacher");
  assert.equal(resolveUserHomePath("ar", { role: "USER", primaryPersona: "TEACHER" }), "/ar/teacher");
  assert.equal(resolveUserHomePath("fr", { role: "USER", primaryPersona: "AVS" }), "/fr/avs/espace");
  assert.equal(resolveUserHomePath("fr", { role: "USER", primaryPersona: "SPECIALIST" }), "/fr/specialist");
  assert.equal(resolveUserHomePath("fr", { role: "USER", primaryPersona: "ORGANIZATION" }), "/fr/organization");
  assert.equal(resolveUserHomePath("fr", { role: "USER", primaryPersona: "STUDENT" }), "/fr/dashboard");
  // Legacy profileType fallback
  assert.equal(resolveUserHomePath("fr", { role: "USER", profileType: "parent" }), "/fr/parent");
  assert.equal(resolveUserHomePath("fr", { role: "USER", profileType: "teacher" }), "/fr/teacher");
});
