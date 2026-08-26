import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start > -1, `${name} not found`);
  const nextExportOffset = source.indexOf("\nexport", start + 1);
  return source.slice(start, nextExportOffset > -1 ? nextExportOffset : undefined);
}

test("homepage uses dedicated bounded/projected queries instead of the shared catalog lists", async () => {
  const [pageSource, catalogSource] = await Promise.all([
    readFile("src/app/[locale]/(site)/page.tsx", "utf8"),
    readFile("src/server/queries/catalog.ts", "utf8"),
  ]);

  assert.equal(pageSource.includes("listHomeCourses()"), true);
  assert.equal(pageSource.includes("listHomeWebinars()"), true);
  assert.equal(pageSource.includes("listHomeAvs()"), true);
  // The shared, larger-projection functions remain untouched for CRM/list-page callers.
  assert.equal(pageSource.includes("listPublishedCourses()"), false);
  assert.equal(pageSource.includes("listPublishedWebinars()"), false);
  assert.equal(pageSource.includes("listVisibleAvs()"), false);

  assert.equal(catalogSource.includes("export async function listHomeCourses"), true);
  assert.equal(catalogSource.includes("export async function listHomeWebinars"), true);
  assert.equal(catalogSource.includes("export async function listHomeAvs"), true);
});

test("home query projections stay bounded and skip unused heavy columns", async () => {
  const catalogSource = await readFile("src/server/queries/catalog.ts", "utf8");

  const homeCourses = functionBody(catalogSource, "listHomeCourses");
  assert.equal(homeCourses.includes("descriptionFr"), false, "homepage course projection must skip unused description columns");
  assert.equal(homeCourses.includes("objectives"), false, "homepage course projection must skip the unused objectives column");
  assert.equal(homeCourses.includes(".limit(24)"), true, "course pool must stay large enough to derive up to 6 distinct category chips");

  const homeWebinars = functionBody(catalogSource, "listHomeWebinars");
  assert.equal(homeWebinars.includes("descriptionFr"), false);
  assert.equal(homeWebinars.includes(".limit(2)"), true, "homepage renders only the next 2 webinars");

  const homeAvs = functionBody(catalogSource, "listHomeAvs");
  assert.equal(homeAvs.includes("bioFr"), false);
  assert.equal(homeAvs.includes(".limit(3)"), true, "homepage renders only 3 AVS cards");
});
