import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGoogleCalendarUrl,
  generateIcsCalendar,
  getProviderMeta,
  generateAccessCode,
  DEFAULT_WEBINAR_FORM_FIELDS,
} from "../../src/lib/webinars";

test("getProviderMeta returns accurate metadata for Google Meet and Teams", () => {
  const meet = getProviderMeta("google_meet");
  assert.equal(meet.id, "google_meet");
  assert.equal(meet.name, "Google Meet");
  assert.equal(meet.nameAr, "جوجل ميت");
  assert.equal(meet.iconName, "google");
  assert.equal(meet.helperUrl, "https://meet.google.com/new");

  const teams = getProviderMeta("teams");
  assert.equal(teams.id, "teams");
  assert.equal(teams.name, "Microsoft Teams");
  assert.equal(teams.nameAr, "مايكروسوفت تيمز");
  assert.equal(teams.iconName, "teams");
  assert.equal(teams.helperUrl, "https://teams.microsoft.com/");

  const fallback = getProviderMeta("unknown_platform");
  assert.equal(fallback.id, "google_meet");
});

test("buildGoogleCalendarUrl generates standard one-click add URL with duration calculation", () => {
  const startsAt = new Date("2026-10-15T14:00:00.000Z");
  const url = buildGoogleCalendarUrl({
    title: "Webinaire Inclusion Scolaire",
    description: "Session pratique sur l'accompagnement des élèves TSA.",
    startsAt,
    durationMinutes: 90,
    meetingUrl: "https://meet.google.com/abc-defg-hij",
  });

  assert.ok(url.startsWith("https://calendar.google.com/calendar/render?"));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("action"), "TEMPLATE");
  assert.equal(parsed.searchParams.get("text"), "Webinaire Inclusion Scolaire");
  assert.equal(parsed.searchParams.get("dates"), "20261015T140000Z/20261015T153000Z");
  assert.ok(parsed.searchParams.get("details")?.includes("https://meet.google.com/abc-defg-hij"));
  assert.equal(parsed.searchParams.get("location"), "https://meet.google.com/abc-defg-hij");
});

test("generateIcsCalendar produces valid RFC 5545 iCalendar data with 15min alarm", () => {
  const startsAt = new Date("2026-11-20T10:00:00.000Z");
  const ics = generateIcsCalendar({
    id: "webinar-test-uuid",
    title: "Coopérer avec les familles",
    description: "Méthodes et outils pour une alliance éducative réussie.",
    startsAt,
    durationMinutes: 60,
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/12345",
  });

  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("VERSION:2.0"));
  assert.ok(ics.includes("PRODID:-//ANEI Academy//Webinars//FR"));
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("UID:webinar-webinar-test-uuid@anei.education"));
  assert.ok(ics.includes("DTSTART:20261120T100000Z"));
  assert.ok(ics.includes("DTEND:20261120T110000Z"));
  assert.ok(ics.includes("SUMMARY:Coopérer avec les familles"));
  assert.ok(ics.includes("LOCATION:https://teams.microsoft.com/l/meetup-join/12345"));
  assert.ok(ics.includes("BEGIN:VALARM"));
  assert.ok(ics.includes("TRIGGER:-PT15M"));
  assert.ok(ics.includes("END:VALARM"));
  assert.ok(ics.includes("END:VEVENT"));
  assert.ok(ics.includes("END:VCALENDAR"));
});

test("generateAccessCode produces 128-bit entropy CSPRNG code", () => {
  const code1 = generateAccessCode();
  const code2 = generateAccessCode("TEAMS");

  assert.match(code1, /^MEET-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
  assert.match(code2, /^TEAMS-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
  assert.notEqual(code1, code2);
});

test("DEFAULT_WEBINAR_FORM_FIELDS provides standard required and optional fields", () => {
  assert.ok(DEFAULT_WEBINAR_FORM_FIELDS.length >= 4);
  const phoneField = DEFAULT_WEBINAR_FORM_FIELDS.find((f) => f.id === "phone");
  const roleField = DEFAULT_WEBINAR_FORM_FIELDS.find((f) => f.id === "role");
  assert.ok(phoneField);
  assert.equal(phoneField?.type, "phone");
  assert.equal(phoneField?.required, true);
  assert.ok(roleField);
  assert.equal(roleField?.required, true);
});
