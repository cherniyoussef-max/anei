import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const checkScript = path.join(repoRoot, "tests/security/fixtures/env-load-check.mts");
const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

const validProductionEnv: Record<string, string> = {
  NODE_ENV: "production",
  APP_URL: "https://staging.anei.example",
  BETTER_AUTH_URL: "https://staging.anei.example",
  BETTER_AUTH_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX",
  TRUSTED_ORIGINS: "https://staging.anei.example",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
  DATABASE_URL: "postgresql://real:realpass@neon.example/anei",
  SMTP_HOST: "smtp-relay.brevo.com",
  SMTP_USER: "user@brevo.example",
  SMTP_PASS: "secret",
  SMTP_FROM: "ANEI <no-reply@anei.tn>",
  CONTACT_EMAIL: "contact@anei.tn",
  CONTACT_ADDRESS: "Some Real Address, Tunis",
  STORAGE_PROVIDER: "s3-compatible",
  STORAGE_BUCKET: "bucket",
  STORAGE_REGION: "eu-west-1",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
};

function loadEnv(overrides: Record<string, string>) {
  const result = spawnSync(
    tsxBin,
    [checkScript],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        ...validProductionEnv,
        ...overrides,
      } as unknown as NodeJS.ProcessEnv,
    },
  );
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

test("production (default deployment mode) rejects mock payments", () => {
  const { ok, output } = loadEnv({ PAYMENT_DEFAULT_PROVIDER: "mock", PAYMENT_ALLOW_MOCK: "true" });
  assert.equal(ok, false);
  assert.match(output, /Mock payments are forbidden in production/);
});

test("staging with mock explicitly enabled on both flags is accepted", () => {
  const { ok, output } = loadEnv({
    ANEI_DEPLOYMENT_ENV: "staging",
    PAYMENT_DEFAULT_PROVIDER: "mock",
    PAYMENT_ALLOW_MOCK: "true",
  });
  assert.equal(ok, true, output);
});

test("staging with PAYMENT_ALLOW_MOCK disabled still rejects mock", () => {
  const { ok, output } = loadEnv({
    ANEI_DEPLOYMENT_ENV: "staging",
    PAYMENT_DEFAULT_PROVIDER: "mock",
    PAYMENT_ALLOW_MOCK: "false",
  });
  assert.equal(ok, false);
  assert.match(output, /Mock payments are forbidden in production/);
});

test("staging with a non-mock default provider does not get a mock exemption", () => {
  const { ok, output } = loadEnv({
    ANEI_DEPLOYMENT_ENV: "staging",
    PAYMENT_ALLOW_MOCK: "true",
    PAYMENT_DEFAULT_PROVIDER: "flouci",
    ENABLE_FLOUCI: "false",
  });
  assert.equal(ok, false);
  assert.match(output, /Mock payments are forbidden in production/);
});

test("explicit ANEI_DEPLOYMENT_ENV=production behaves identically to the default", () => {
  const { ok, output } = loadEnv({
    ANEI_DEPLOYMENT_ENV: "production",
    PAYMENT_DEFAULT_PROVIDER: "mock",
    PAYMENT_ALLOW_MOCK: "true",
  });
  assert.equal(ok, false);
  assert.match(output, /Mock payments are forbidden in production/);
});

test("production with a real payment provider is unaffected by the staging mechanism", () => {
  const { ok, output } = loadEnv({
    PAYMENT_DEFAULT_PROVIDER: "flouci",
    ENABLE_FLOUCI: "true",
    FLOUCI_PUBLIC_KEY: "pub",
    FLOUCI_PRIVATE_KEY: "priv",
  });
  assert.equal(ok, true, output);
});
