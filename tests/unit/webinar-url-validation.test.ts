import test from "node:test";
import assert from "node:assert/strict";
import { validateWebinarMeetingUrl, adminWebinarCreateSchema } from "@/lib/webinar-validation";

test("Fix 1 TDD: validateWebinarMeetingUrl rejects dangerous protocols, userinfo, and non-allowlisted hosts", () => {
  // 1. Dangerous protocols
  assert.equal(validateWebinarMeetingUrl("google_meet", "javascript:alert(1)").valid, false);
  assert.equal(validateWebinarMeetingUrl("google_meet", "data:text/html,<script>alert(1)</script>").valid, false);
  assert.equal(validateWebinarMeetingUrl("google_meet", "vbscript:msgbox(1)").valid, false);

  // 2. HTTP protocol rejected (must be HTTPS only)
  assert.equal(validateWebinarMeetingUrl("google_meet", "http://meet.google.com/abc-defg-hij").valid, false);
  assert.equal(validateWebinarMeetingUrl("teams", "http://teams.microsoft.com/l/meetup-join/123").valid, false);
  assert.equal(validateWebinarMeetingUrl("zoom", "http://zoom.us/j/123456789").valid, false);

  // 3. Userinfo in URL rejected (e.g. https://evil.com@meet.google.com)
  assert.equal(validateWebinarMeetingUrl("google_meet", "https://evil.com@meet.google.com/abc").valid, false);

  // 4. Non-allowlisted host rejected per provider
  assert.equal(validateWebinarMeetingUrl("google_meet", "https://evil-phishing.com/meet").valid, false);
  assert.equal(validateWebinarMeetingUrl("teams", "https://evil-teams.com/l/meetup").valid, false);
  assert.equal(validateWebinarMeetingUrl("zoom", "https://notzoom.com/j/123").valid, false);

  // 5. Valid provider URLs accepted
  assert.equal(validateWebinarMeetingUrl("google_meet", "https://meet.google.com/abc-defg-hij").valid, true);
  assert.equal(validateWebinarMeetingUrl("teams", "https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz").valid, true);
  assert.equal(validateWebinarMeetingUrl("teams", "https://teams.live.com/meet/123456").valid, true);
  assert.equal(validateWebinarMeetingUrl("zoom", "https://us02web.zoom.us/j/1234567890?pwd=secret").valid, true);
  assert.equal(validateWebinarMeetingUrl("zoom", "https://zoom.us/j/987654321").valid, true);

  // 6. Custom provider requires valid HTTPS URL
  assert.equal(validateWebinarMeetingUrl("custom", "https://webinar.partner.org/live").valid, true);
  assert.equal(validateWebinarMeetingUrl("custom", "http://webinar.partner.org/live").valid, false);
  assert.equal(validateWebinarMeetingUrl("custom", "javascript:void(0)").valid, false);

  // 7. in_person provider never accepts a meetingUrl
  assert.equal(validateWebinarMeetingUrl("in_person", "https://meet.google.com/abc").valid, false);
});

test("Fix 1 TDD: adminWebinarCreateSchema enforces discriminated union between online and in_person", () => {
  const baseData = {
    slug: "inclusion-scolaire-2026",
    titleFr: "L'inclusion scolaire",
    titleAr: "الدمج المدرسي",
    descriptionFr: "Formation pratique",
    descriptionAr: "تدريب تطبيقي",
    trainerName: "Dr. Amina",
    startsAt: "2026-10-15T14:00:00.000Z",
    durationMinutes: 90,
  };

  // Online provider without meetingUrl must fail
  const onlineNoUrl = adminWebinarCreateSchema.safeParse({
    ...baseData,
    meetingProvider: "google_meet",
    meetingUrl: null,
  });
  assert.equal(onlineNoUrl.success, false, "Online provider must require meetingUrl");

  // Online provider with non-allowlisted meetingUrl must fail
  const onlineBadUrl = adminWebinarCreateSchema.safeParse({
    ...baseData,
    meetingProvider: "google_meet",
    meetingUrl: "https://evil-phishing.com/fake-meet",
  });
  assert.equal(onlineBadUrl.success, false, "Online provider must reject non-allowlisted host");

  // Online provider with javascript: URL must fail
  const onlineXss = adminWebinarCreateSchema.safeParse({
    ...baseData,
    meetingProvider: "teams",
    meetingUrl: "javascript:alert(document.cookie)",
  });
  assert.equal(onlineXss.success, false, "Online provider must reject javascript: URL");

  // Online provider with valid URL must succeed
  const onlineValid = adminWebinarCreateSchema.safeParse({
    ...baseData,
    meetingProvider: "google_meet",
    meetingUrl: "https://meet.google.com/xyz-uvwx-rst",
  });
  assert.equal(onlineValid.success, true, "Online provider with valid URL must succeed");

  // In-person session without location must fail
  const inPersonNoLoc = adminWebinarCreateSchema.safeParse({
    ...baseData,
    meetingProvider: "in_person",
    meetingUrl: null,
  });
  assert.equal(inPersonNoLoc.success, false, "In-person provider must require location");

  // In-person session with valid location and null meetingUrl must succeed
  const inPersonValid = adminWebinarCreateSchema.safeParse({
    ...baseData,
    meetingProvider: "in_person",
    location: "Salle des congrès, Tunis",
    meetingUrl: null,
  });
  assert.equal(inPersonValid.success, true, "In-person with location must succeed");

  // In-person session with meetingUrl must fail
  const inPersonWithMeetingUrl = adminWebinarCreateSchema.safeParse({
    ...baseData,
    meetingProvider: "in_person",
    location: "Salle des congrès, Tunis",
    meetingUrl: "https://meet.google.com/xyz",
  });
  assert.equal(inPersonWithMeetingUrl.success, false, "In-person provider must reject meetingUrl");
});
