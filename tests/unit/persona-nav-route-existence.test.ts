/**
 * Route-existence contract: every href rendered by a persona portal's
 * navigation (PersonaPortalShell `items` + `profileHref`) must resolve to a
 * real page.tsx. This is a static-source check (mirrors
 * persona-route-contracts.test.ts) so it never needs a running server or
 * database, and it's what should catch the next "/parent/enfants -> 404"
 * regression before it reaches staging.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const portalLayoutFiles = [
  "src/app/[locale]/(site)/teacher/layout.tsx",
  "src/app/[locale]/(site)/parent/layout.tsx",
  "src/app/[locale]/(site)/specialist/layout.tsx",
  "src/app/[locale]/(site)/organization/layout.tsx",
  "src/app/[locale]/(site)/avs/espace/layout.tsx",
];

// `href: \`/${locale}/foo/bar\`` -> "/foo/bar" (drop the interpolated locale prefix).
const HREF_PATTERN = /href:\s*`\/\$\{locale\}([a-z0-9/-]*)`/g;
const PROFILE_HREF_PATTERN = /profileHref=\{`\/\$\{locale\}([a-z0-9/-]*)`\}/;

function routeToPageFile(route: string): string {
  const segments = route.split("/").filter(Boolean);
  return `src/app/[locale]/(site)/${segments.join("/")}/page.tsx`;
}

test("every persona portal nav item href resolves to a real page.tsx", async () => {
  for (const file of portalLayoutFiles) {
    const source = await readFile(file, "utf8");
    const hrefs = [...source.matchAll(HREF_PATTERN)].map((match) => match[1]);
    assert.ok(hrefs.length > 0, `${file} must declare at least one nav item`);
    for (const route of hrefs) {
      const pageFile = routeToPageFile(route);
      assert.ok(existsSync(pageFile), `${file} links to "${route}" but ${pageFile} does not exist`);
    }
  }
});

test("every persona portal's profileHref resolves to a real page.tsx", async () => {
  for (const file of portalLayoutFiles) {
    const source = await readFile(file, "utf8");
    const match = source.match(PROFILE_HREF_PATTERN);
    assert.ok(match, `${file} must pass a profileHref to PersonaPortalShell`);
    const pageFile = routeToPageFile(match![1]);
    assert.ok(existsSync(pageFile), `${file} profileHref "${match![1]}" but ${pageFile} does not exist`);
  }
});

test("PersonaPortalShell requires callers to pass profileHref (no implicit /dashboard/profil default)", async () => {
  const source = await readFile("src/modules/personas/components/PersonaPortalShell.tsx", "utf8");
  assert.equal(source.includes("profileHref: string"), true);
  assert.equal(source.includes("href={profileHref}"), true);
});
