import assert from "node:assert/strict";
import test from "node:test";
import { hardenPostgresConnectionString } from "@/server/db/connection-string";

test("upgrades legacy strict PostgreSQL SSL modes to explicit verify-full", () => {
  for (const mode of ["prefer", "require", "verify-ca"]) {
    const result = hardenPostgresConnectionString(`postgresql://user:pass@db.example.com/anei?sslmode=${mode}`);
    assert.equal(new URL(result).searchParams.get("sslmode"), "verify-full");
  }
});

test("preserves explicit PostgreSQL SSL modes and unrelated query parameters", () => {
  const original = "postgresql://user:pass@db.example.com/anei?sslmode=verify-full&application_name=anei";
  assert.equal(hardenPostgresConnectionString(original), original);

  const disabled = "postgresql://user:pass@localhost/anei?sslmode=disable";
  assert.equal(hardenPostgresConnectionString(disabled), disabled);
});

test("leaves non-PostgreSQL and malformed values untouched", () => {
  assert.equal(hardenPostgresConnectionString("not-a-url"), "not-a-url");
  assert.equal(hardenPostgresConnectionString("redis://localhost:6379"), "redis://localhost:6379");
});
