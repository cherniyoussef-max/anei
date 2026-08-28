import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("mailer logs structured send events without leaking the verification URL or token", async () => {
  const source = await readFile("src/server/services/mailer.ts", "utf8");
  assert.match(source, /mail\.send\.started/);
  assert.match(source, /mail\.send\.succeeded/);
  assert.match(source, /mail\.send\.failed/);
  // The logger calls must never receive the raw message body/url/token - only
  // sanitized fields (type, masked recipient, provider, category, messageId).
  assert.equal(/logger\.(info|error)\("mail\.send\.\w+",\s*{[^}]*\burl\b/.test(source), false, "mailer must not log the raw verification/reset URL");
  assert.equal(/logger\.(info|error)\("mail\.send\.\w+",\s*{[^}]*\btoken\b/.test(source), false, "mailer must not log the raw token");
});

test("verification resend route enforces trusted origin, input validation, and server-side rate limiting", async () => {
  const source = await readFile("src/app/api/auth/verification/resend/route.ts", "utf8");
  assert.match(source, /isTrustedMutation/);
  assert.match(source, /schema\.safeParse/);
  assert.match(source, /consumeRateLimit/);
  assert.match(source, /RESEND_COOLDOWN/);
  // Must never accept a client-supplied verification status.
  assert.equal(source.includes("emailVerified"), false, "resend route must never accept a client-supplied emailVerified flag");
});

test("verify-email page never hardcodes /dashboard and routes success through the onboarding resolver", async () => {
  const source = await readFile("src/app/[locale]/(auth)/verify-email/page.tsx", "utf8");
  assert.match(source, /resolveOnboardingState/);
  assert.match(source, /onboardingPathFor/);
  assert.equal(source.includes("/dashboard"), false, "verify-email page must not hardcode a dashboard redirect");
});

test("verify-email pending form never renders a raw verification token or full callback URL", async () => {
  const source = await readFile("src/components/auth/VerifyEmailPendingForm.tsx", "utf8");
  assert.equal(source.includes("token"), false);
});
