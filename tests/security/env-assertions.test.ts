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
  ANEI_DEPLOYMENT_ENV: "production",
  APP_URL: "https://anei.tn",
  BETTER_AUTH_URL: "https://anei.tn",
  BETTER_AUTH_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX0123456789!@#$%^",
  TRUSTED_ORIGINS: "https://anei.tn",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
  DATABASE_URL: "postgresql://anei_prod_user:StrongPassword123!@db.anei.tn:5432/anei_production",
  SMTP_HOST: "smtp-relay.brevo.com",
  SMTP_USER: "user@brevo.example",
  SMTP_PASS: "secret12345",
  SMTP_FROM: "ANEI <no-reply@anei.tn>",
  CONTACT_EMAIL: "contact@anei.tn",
  CONTACT_ADDRESS: "Immeuble ANEI, Avenue Habib Bourguiba, Tunis",
  STORAGE_PROVIDER: "s3-compatible",
  STORAGE_BUCKET: "anei-production-assets",
  STORAGE_REGION: "eu-west-1",
  STORAGE_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
  STORAGE_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  PAYMENT_DEFAULT_PROVIDER: "flouci",
  ENABLE_FLOUCI: "true",
  FLOUCI_PUBLIC_KEY: "flouci_pub_key_example",
  FLOUCI_PRIVATE_KEY: "flouci_priv_key_example",
  PAYMENT_ALLOW_MOCK: "false",
};

function runEnvCheck(overrides: Record<string, string | undefined>) {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    ...validProductionEnv,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  const result = spawnSync(tsxBin, [checkScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: env as unknown as NodeJS.ProcessEnv,
  });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

test("production boots cleanly with valid production security env", () => {
  const { ok, output } = runEnvCheck({});
  assert.equal(ok, true, `Expected clean boot but got:\n${output}`);
});

test("production rejects short BETTER_AUTH_SECRET (< 48 chars)", () => {
  const { ok, output } = runEnvCheck({ BETTER_AUTH_SECRET: "too-short-secret-less-than-48-chars" });
  assert.equal(ok, false);
  assert.match(output, /BETTER_AUTH_SECRET must be a strong production secret of at least 48 characters/);
});

test("production rejects default development-only BETTER_AUTH_SECRET", () => {
  const { ok, output } = runEnvCheck({ BETTER_AUTH_SECRET: "development-only-secret-change-me-12345678901234567890" });
  assert.equal(ok, false);
  assert.match(output, /BETTER_AUTH_SECRET must be a strong production secret of at least 48 characters/);
});

test("production rejects insecure HTTP APP_URL", () => {
  const { ok, output } = runEnvCheck({ APP_URL: "http://anei.tn" });
  assert.equal(ok, false);
  assert.match(output, /APP_URL and BETTER_AUTH_URL must use HTTPS in production/);
});

test("production rejects insecure HTTP BETTER_AUTH_URL", () => {
  const { ok, output } = runEnvCheck({ BETTER_AUTH_URL: "http://anei.tn" });
  assert.equal(ok, false);
  assert.match(output, /APP_URL and BETTER_AUTH_URL must use HTTPS in production/);
});

test("production rejects localhost in TRUSTED_ORIGINS", () => {
  const { ok, output } = runEnvCheck({ TRUSTED_ORIGINS: "https://anei.tn,http://localhost:3000" });
  assert.equal(ok, false);
  assert.match(output, /TRUSTED_ORIGINS must not contain localhost in production/);
});

test("production rejects 127.0.0.1 in TRUSTED_ORIGINS", () => {
  const { ok, output } = runEnvCheck({ TRUSTED_ORIGINS: "https://anei.tn,http://127.0.0.1:3000" });
  assert.equal(ok, false);
  assert.match(output, /TRUSTED_ORIGINS must not contain localhost in production/);
});

test("production rejects default development database credentials in DATABASE_URL", () => {
  const { ok, output } = runEnvCheck({ DATABASE_URL: "postgresql://anei:anei@localhost:5432/anei" });
  assert.equal(ok, false);
  assert.match(output, /DATABASE_URL must be an explicit non-development database credential in production/);
});

test("production rejects mock payments (PAYMENT_ALLOW_MOCK=true or PAYMENT_DEFAULT_PROVIDER=mock)", () => {
  const { ok, output } = runEnvCheck({ PAYMENT_ALLOW_MOCK: "true", PAYMENT_DEFAULT_PROVIDER: "mock" });
  assert.equal(ok, false);
  assert.match(output, /Mock payments are forbidden in production/);
});

test("production rejects STORAGE_PROVIDER=local", () => {
  const { ok, output } = runEnvCheck({ STORAGE_PROVIDER: "local" });
  assert.equal(ok, false);
  assert.match(output, /Production protected media requires STORAGE_PROVIDER=s3-compatible/);
});

test("production rejects SMTP_HOST=localhost", () => {
  const { ok, output } = runEnvCheck({ SMTP_HOST: "localhost" });
  assert.equal(ok, false);
  assert.match(output, /Production email verification requires a real SMTP\/provider host, not localhost/);
});

test("production rejects AUTH_REQUIRE_EMAIL_VERIFICATION disabled", () => {
  const { ok, output } = runEnvCheck({ AUTH_REQUIRE_EMAIL_VERIFICATION: "false" });
  assert.equal(ok, false);
  assert.match(output, /AUTH_REQUIRE_EMAIL_VERIFICATION must be enabled in production/);
});

test("production rejects SEED_DEMO_DATA=true", () => {
  const { ok, output } = runEnvCheck({ SEED_DEMO_DATA: "true" });
  assert.equal(ok, false);
  assert.match(output, /SEED_DEMO_DATA must be false in production/);
});

test("production rejects ENABLE_AI=true until security hardening is complete", () => {
  const { ok, output } = runEnvCheck({ ENABLE_AI: "true" });
  assert.equal(ok, false);
  assert.match(output, /ENABLE_AI cannot be true in production/);
});

test("production and staging reject META_WEBHOOK_ALLOW_UNSIGNED=true", () => {
  const { ok, output } = runEnvCheck({ META_WEBHOOK_ALLOW_UNSIGNED: "true" });
  assert.equal(ok, false);
  assert.match(output, /META_WEBHOOK_ALLOW_UNSIGNED is strictly forbidden outside local development/);
});

