import test from "node:test";
import assert from "node:assert/strict";
import { hasAdminPermission } from "@/modules/admin/domain/permissions";
import { detectProviderAndEmbedMode, liveSessionCreateSchema } from "@/lib/live-validation";
import { issueSudoToken, verifySudoToken } from "@/server/auth/sudo";
import { signImpersonationToken, verifyImpersonationToken, type ImpersonationPayload } from "@/server/auth/impersonation";

test("Live RBAC: live.manage is granted to ADMIN and SUPER_ADMIN, but live.broadcast.global is exclusive to SUPER_ADMIN", () => {
  // USER has neither
  assert.equal(hasAdminPermission("USER", "live.manage"), false);
  assert.equal(hasAdminPermission("USER", "live.broadcast.global"), false);

  // ADMIN can manage course meetings but CANNOT trigger global broadcast push or delete
  assert.equal(hasAdminPermission("ADMIN", "live.manage"), true);
  assert.equal(hasAdminPermission("ADMIN", "live.broadcast.global"), false);

  // SUPER_ADMIN has full permissions
  assert.equal(hasAdminPermission("SUPER_ADMIN", "live.manage"), true);
  assert.equal(hasAdminPermission("SUPER_ADMIN", "live.broadcast.global"), true);
});

test("Live Provider Detection: correctly detects Meet, Zoom, and Jitsi with appropriate embed modes", () => {
  const meet = detectProviderAndEmbedMode("https://meet.google.com/abc-defg-hij");
  assert.equal(meet.provider, "GOOGLE_MEET");
  assert.equal(meet.embedMode, "PORTAL_LAUNCH");

  const zoom = detectProviderAndEmbedMode("https://us02web.zoom.us/j/1234567890");
  assert.equal(zoom.provider, "ZOOM");
  assert.equal(zoom.embedMode, "PORTAL_LAUNCH");

  const jitsi = detectProviderAndEmbedMode("https://meet.jit.si/anei-inclusive-edu");
  assert.equal(jitsi.provider, "JITSI");
  assert.equal(jitsi.embedMode, "IFRAME_EMBED");

  const teams = detectProviderAndEmbedMode("https://teams.microsoft.com/l/meetup-join/19%3ameeting");
  assert.equal(teams.provider, "MICROSOFT_TEAMS");
  assert.equal(teams.embedMode, "PORTAL_LAUNCH");

  const custom = detectProviderAndEmbedMode("https://example.com/stream");
  assert.equal(custom.provider, "CUSTOM_EMBED");
});

test("Live Validation: validates required bilingual titles, start date, and limits durations", () => {
  const validData = {
    titleFr: "Atelier Inclusion Scolaire",
    titleAr: "ورشة الإدماج المدرسي",
    descriptionFr: "Description détaillée",
    descriptionAr: "وصف مفصل",
    provider: "GOOGLE_MEET",
    externalMeetingUrl: "https://meet.google.com/abc-defg-hij",
    embedMode: "PORTAL_LAUNCH",
    scope: "GLOBAL_WEBINAR",
    scheduledStartAt: new Date(Date.now() + 86400000).toISOString(),
    durationMinutes: 90,
  };

  const parsed = liveSessionCreateSchema.safeParse(validData);
  assert.equal(parsed.success, true);

  // Rejects invalid URL
  const invalidUrl = liveSessionCreateSchema.safeParse({ ...validData, externalMeetingUrl: "not-a-url" });
  assert.equal(invalidUrl.success, false);

  // Rejects missing Arabic title
  const missingAr = liveSessionCreateSchema.safeParse({ ...validData, titleAr: "" });
  assert.equal(missingAr.success, false);

  // Rejects negative or zero duration
  const invalidDuration = liveSessionCreateSchema.safeParse({ ...validData, durationMinutes: -10 });
  assert.equal(invalidDuration.success, false);
});

test("Live Security: Sudo Mode token protects critical live broadcast and deletion actions", () => {
  const adminId = "super-admin-uuid-1234";
  const otherId = "other-admin-uuid-5678";

  const { token, expiresAt } = issueSudoToken(adminId);
  assert.ok(token);
  assert.ok(expiresAt.getTime() > Date.now());

  // Valid for the legitimate admin
  assert.equal(verifySudoToken(token, adminId), true);

  // Rejects when verified for a different admin (privilege escalation block)
  assert.equal(verifySudoToken(token, otherId), false);
});

test("Live Security: Impersonation token validates dual-identity to prevent attendance falsification", () => {
  const impersonatorId = "super-admin-uuid-1234";
  const studentId = "student-target-uuid-9999";

  const payload: ImpersonationPayload = {
    impersonatorId,
    impersonatorName: "Admin Test",
    impersonatorEmail: "admin@anei.tn",
    targetUserId: studentId,
    targetUserName: "Student Target",
    targetUserEmail: "student@anei.tn",
    startedAt: Date.now(),
    expiresAt: Date.now() + 1800000,
  };

  const token = signImpersonationToken(payload);
  assert.ok(token);

  const verified = verifyImpersonationToken(token);
  assert.notEqual(verified, null);
  assert.equal(verified?.impersonatorId, impersonatorId);
  assert.equal(verified?.targetUserId, studentId);
});
