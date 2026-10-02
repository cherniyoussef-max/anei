import test from "node:test";
import assert from "node:assert/strict";
import { isTrustedMutationHeaders, normalizeTrustedOrigins } from "@/lib/security/origin-policy";

const trusted = normalizeTrustedOrigins([
  "https://anei.tn",
  "https://staging.anei.tn",
]);

test("csrf-origin: exact trusted origin is allowed", () => {
  const headers = new Headers({
    Origin: "https://anei.tn",
    "Sec-Fetch-Site": "same-origin",
  });
  assert.equal(isTrustedMutationHeaders(headers, trusted), true);

  const stagingHeaders = new Headers({
    Origin: "https://staging.anei.tn",
    "Sec-Fetch-Site": "same-origin",
  });
  assert.equal(isTrustedMutationHeaders(stagingHeaders, trusted), true);
});

test("csrf-origin: cross-site browser requests are immediately rejected", () => {
  const headers = new Headers({
    Origin: "https://attacker.com",
    "Sec-Fetch-Site": "cross-site",
  });
  assert.equal(isTrustedMutationHeaders(headers, trusted), false);
});

test("csrf-origin: foreign origins claiming same-origin are rejected", () => {
  const headers = new Headers({
    Origin: "https://evil.example.com",
    "Sec-Fetch-Site": "same-origin",
  });
  assert.equal(isTrustedMutationHeaders(headers, trusted), false);
});

test("csrf-origin: spoofed domain prefixes/suffixes are rejected", () => {
  const spoofedPrefix = new Headers({
    Origin: "https://anei.tn.evil.com",
    "Sec-Fetch-Site": "cross-site",
  });
  assert.equal(isTrustedMutationHeaders(spoofedPrefix, trusted), false);

  const spoofedPrefix2 = new Headers({
    Origin: "https://evil-anei.tn",
    "Sec-Fetch-Site": "same-origin",
  });
  assert.equal(isTrustedMutationHeaders(spoofedPrefix2, trusted), false);
});

test("csrf-origin: sibling same-site subdomain is rejected without exact origin match", () => {
  const headers = new Headers({
    Origin: "https://blog.anei.tn",
    "Sec-Fetch-Site": "same-site",
  });
  assert.equal(isTrustedMutationHeaders(headers, trusted), false);
});

test("csrf-origin: Referer fallback when Origin header is omitted by browser", () => {
  const validReferer = new Headers({
    Referer: "https://anei.tn/fr/dashboard/lessons",
    "Sec-Fetch-Site": "same-origin",
  });
  assert.equal(isTrustedMutationHeaders(validReferer, trusted), true);

  const foreignReferer = new Headers({
    Referer: "https://attacker.com/exploit",
    "Sec-Fetch-Site": "cross-site",
  });
  assert.equal(isTrustedMutationHeaders(foreignReferer, trusted), false);
});

test("csrf-origin: direct non-browser requests fall through to authentication", () => {
  const headers = new Headers();
  assert.equal(isTrustedMutationHeaders(headers, trusted), true);
});
