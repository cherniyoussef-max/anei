import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("protected session helpers enforce assurance for app access", async () => {
  const source = await readFile("src/server/auth/session.ts", "utf8");
  assert.match(source, /getSessionWithAssurance/);
  assert.match(source, /verification-channel/);
  assert.match(source, /getCachedSessionAssurance\(current\.session\.id\)/);
});

test("auth form routes primary auth to verification channel and keeps Google button", async () => {
  const source = await readFile("src/components/interactive/AuthForm.tsx", "utf8");
  assert.match(source, /verification-channel/);
  assert.match(source, /signIn\.social/);
  assert.match(source, /provider: "google"/);
  assert.equal(source.includes("<GoogleOneTap"), false);
});

test("OTP APIs keep strict server allowlists for channels and code format", async () => {
  const [sendSource, verifySource] = await Promise.all([
    readFile("src/app/api/auth/assurance/send-otp/route.ts", "utf8"),
    readFile("src/app/api/auth/assurance/verify-otp/route.ts", "utf8"),
  ]);
  assert.match(sendSource, /z\.enum\(\["EMAIL", "WHATSAPP"\]\)/);
  assert.match(sendSource, /isTrustedMutation/);
  assert.match(verifySource, /regex\(\/\^\\d\{6\}\$\//);
  assert.match(verifySource, /completeSessionAssurance/);
});

test("password reset API enforces server-side length policy", async () => {
  const source = await readFile("src/app/api/auth/password/reset/route.ts", "utf8");
  assert.match(source, /newPassword: z\.string\(\)\.min\(15\)\.max\(128\)/);
});
