import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { googleAuthErrorMessage } from "../../src/lib/auth-errors";
import { safeAppRedirect } from "../../src/lib/security/safe-redirect";
import { enforceNewUserDefaults } from "../../src/server/auth/policy";
import { isGoogleAuthConfigured } from "../../src/server/auth/google-config";

test("Google provider is enabled only with the feature flag and both credentials", () => {
  assert.equal(isGoogleAuthConfigured({ enabled: true, clientId: "id", clientSecret: "secret" }), true);
  assert.equal(isGoogleAuthConfigured({ enabled: false, clientId: "id", clientSecret: "secret" }), false);
  assert.equal(isGoogleAuthConfigured({ enabled: true, clientId: "id" }), false);
  assert.equal(isGoogleAuthConfigured({ enabled: true, clientSecret: "secret" }), false);
  assert.equal(isGoogleAuthConfigured({ enabled: true, clientId: " ", clientSecret: "secret" }), false);
});

test("new Google users always receive USER regardless of provider input", () => {
  assert.equal(enforceNewUserDefaults({ email: "new@example.com" }).role, "USER");
  assert.equal(enforceNewUserDefaults({ email: "new@example.com", role: "ADMIN" }).role, "USER");
  assert.equal(enforceNewUserDefaults({ email: "new@example.com", role: "SUPER_ADMIN" }).role, "USER");
});

test("Google account creation uses safe learner defaults", () => {
  assert.deepEqual(
    enforceNewUserDefaults({ email: "new@example.com" }),
    { email: "new@example.com", role: "USER", locale: "fr", profileType: "learner" },
  );
});

test("French and Arabic Google callbacks remain locale scoped", () => {
  assert.equal(safeAppRedirect(undefined, "fr"), "/fr/dashboard");
  assert.equal(safeAppRedirect(undefined, "ar"), "/ar/dashboard");
});

test("malicious Google callback destinations are rejected", () => {
  for (const value of [
    "https://attacker.invalid/fr/dashboard",
    "//attacker.invalid/fr/dashboard",
    "/fr/\\attacker.invalid",
    "/ar/dashboard",
  ]) {
    assert.equal(safeAppRedirect(value, "fr"), "/fr/dashboard");
  }
});

test("OAuth errors are localized without exposing raw provider details", () => {
  assert.match(googleAuthErrorMessage("fr", "oauth_callback_error") ?? "", /Google/);
  assert.match(googleAuthErrorMessage("ar", "account_not_linked") ?? "", /Google/);
  assert.equal(googleAuthErrorMessage("fr", null), null);
});

test("Google provider, One Tap, and account-linking policies are conditional", async () => {
  const source = await readFile("src/server/auth/index.ts", "utf8");
  assert.match(source, /socialProviders: googleAuthConfigured/);
  assert.match(source, /plugins: googleAuthConfigured \? \[oneTap\(\)\] : \[\]/);
  assert.match(source, /allowDifferentEmails: false/);
  assert.match(source, /requireLocalEmailVerified: true/);
  assert.match(source, /encryptOAuthTokens: true/);
});

test("client authentication keeps OAuth fallback and non-aggressive One Tap", async () => {
  const [form, client, oneTapSource] = await Promise.all([
    readFile("src/components/interactive/AuthForm.tsx", "utf8"),
    readFile("src/lib/auth-client.ts", "utf8"),
    readFile("src/components/auth/GoogleOneTap.tsx", "utf8"),
  ]);
  assert.match(form, /signIn\.social/);
  assert.match(form, /provider: "google"/);
  assert.match(form, /data-testid="google-sign-in"/);
  assert.match(client, /autoSelect: false/);
  assert.match(client, /maxAttempts: 1/);
  assert.match(oneTapSource, /anei-google-one-tap-dismissed/);
});

test("Google secret is never referenced from client-side modules", async () => {
  const files = [
    "src/lib/auth-client.ts",
    "src/components/interactive/AuthForm.tsx",
    "src/components/auth/GoogleOneTap.tsx",
  ];
  for (const file of files) {
    assert.equal((await readFile(file, "utf8")).includes("GOOGLE_CLIENT_SECRET"), false, file);
  }
});
