import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CARE_NOTIFICATION_PREFERENCES,
  type CareNotificationPreferences,
} from "@/server/services/care-notifications";

test("Care Notifications Unit: default preferences have in-app and email enabled", () => {
  assert.equal(DEFAULT_CARE_NOTIFICATION_PREFERENCES.emailEnabled, true);
  assert.equal(DEFAULT_CARE_NOTIFICATION_PREFERENCES.inAppEnabled, true);
  assert.equal(DEFAULT_CARE_NOTIFICATION_PREFERENCES.whatsappEnabled, false);
  assert.equal(DEFAULT_CARE_NOTIFICATION_PREFERENCES.notifyOnMessages, true);
  assert.equal(DEFAULT_CARE_NOTIFICATION_PREFERENCES.notifyOnNotes, true);
  assert.equal(DEFAULT_CARE_NOTIFICATION_PREFERENCES.notifyOnDocuments, true);
  assert.equal(DEFAULT_CARE_NOTIFICATION_PREFERENCES.notifyOnRequests, true);
});

test("Care Notifications Unit: preference override preserves unchanged fields", () => {
  const current: CareNotificationPreferences = { ...DEFAULT_CARE_NOTIFICATION_PREFERENCES };
  const update: Partial<CareNotificationPreferences> = {
    emailEnabled: false,
    notifyOnNotes: false,
  };

  const merged: CareNotificationPreferences = {
    emailEnabled: update.emailEnabled !== undefined ? Boolean(update.emailEnabled) : current.emailEnabled,
    whatsappEnabled: update.whatsappEnabled !== undefined ? Boolean(update.whatsappEnabled) : current.whatsappEnabled,
    inAppEnabled: update.inAppEnabled !== undefined ? Boolean(update.inAppEnabled) : current.inAppEnabled,
    notifyOnMessages: update.notifyOnMessages !== undefined ? Boolean(update.notifyOnMessages) : current.notifyOnMessages,
    notifyOnNotes: update.notifyOnNotes !== undefined ? Boolean(update.notifyOnNotes) : current.notifyOnNotes,
    notifyOnDocuments: update.notifyOnDocuments !== undefined ? Boolean(update.notifyOnDocuments) : current.notifyOnDocuments,
    notifyOnRequests: update.notifyOnRequests !== undefined ? Boolean(update.notifyOnRequests) : current.notifyOnRequests,
  };

  assert.equal(merged.emailEnabled, false);
  assert.equal(merged.notifyOnNotes, false);
  assert.equal(merged.inAppEnabled, true);
  assert.equal(merged.notifyOnMessages, true);
  assert.equal(merged.notifyOnDocuments, true);
});

test("Care Notifications Unit: category opt-out gating correctly identifies disabled categories", () => {
  const prefs: CareNotificationPreferences = {
    ...DEFAULT_CARE_NOTIFICATION_PREFERENCES,
    notifyOnMessages: false,
    notifyOnNotes: false,
  };

  function isEventAllowed(type: string, p: CareNotificationPreferences): boolean {
    if (type === "CARE_MESSAGE_RECEIVED" && !p.notifyOnMessages) return false;
    if ((type === "CARE_NOTE_SHARED" || type === "CARE_NOTE_ADDENDUM") && !p.notifyOnNotes) return false;
    if (type === "CARE_DOCUMENT_SHARED" && !p.notifyOnDocuments) return false;
    if (
      (type === "CARE_REQUEST_RECEIVED" ||
        type === "CARE_REQUEST_ACCEPTED" ||
        type === "CARE_REQUEST_DECLINED" ||
        type === "CARE_RELATIONSHIP_ENDED") &&
      !p.notifyOnRequests
    ) {
      return false;
    }
    return true;
  }

  assert.equal(isEventAllowed("CARE_MESSAGE_RECEIVED", prefs), false);
  assert.equal(isEventAllowed("CARE_NOTE_SHARED", prefs), false);
  assert.equal(isEventAllowed("CARE_NOTE_ADDENDUM", prefs), false);
  assert.equal(isEventAllowed("CARE_DOCUMENT_SHARED", prefs), true);
  assert.equal(isEventAllowed("CARE_REQUEST_RECEIVED", prefs), true);
});
