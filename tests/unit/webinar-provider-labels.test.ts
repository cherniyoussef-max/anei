import test from "node:test";
import assert from "node:assert/strict";
import { getProviderMeta, getProviderLabel } from "../../src/lib/webinars";

test("Fix 4 TDD: getProviderMeta resolves all providers accurately with localized names", () => {
  // Test Google Meet
  const meet = getProviderMeta("google_meet");
  assert.equal(meet.id, "google_meet");
  assert.equal(meet.name, "Google Meet");
  assert.equal(meet.nameAr, "جوجل ميت");

  // Test Teams (both lowercase and uppercase/alternate forms)
  const teams = getProviderMeta("teams");
  assert.equal(teams.id, "teams");
  assert.equal(teams.name, "Microsoft Teams");
  assert.equal(teams.nameAr, "مايكروسوفت تيمز");

  const teamsUpper = getProviderMeta("MICROSOFT_TEAMS");
  assert.equal(teamsUpper.id, "teams");

  // Test Zoom
  const zoom = getProviderMeta("zoom");
  assert.equal(zoom.id, "zoom");
  assert.equal(zoom.name, "Zoom");
  assert.equal(zoom.nameAr, "زووم");

  const zoomUpper = getProviderMeta("ZOOM");
  assert.equal(zoomUpper.id, "zoom");

  // Test in_person
  const inPerson = getProviderMeta("in_person");
  assert.equal(inPerson.id, "in_person");
  assert.equal(inPerson.name, "En présentiel");
  assert.equal(inPerson.nameAr, "حضوري");

  // Test custom
  const custom = getProviderMeta("custom");
  assert.equal(custom.id, "custom");
  assert.equal(custom.name, "Lien direct");

  // Test fallback on unknown/null
  const fallback = getProviderMeta(null);
  assert.equal(fallback.id, "google_meet");

  // Test helper function getProviderLabel
  assert.equal(getProviderLabel("zoom", "fr"), "Zoom");
  assert.equal(getProviderLabel("zoom", "ar"), "زووم");
  assert.equal(getProviderLabel("in_person", "fr"), "En présentiel");
  assert.equal(getProviderLabel("in_person", "ar"), "حضوري");
});
