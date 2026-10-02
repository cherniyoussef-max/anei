import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  careAccessLog,
  notifications,
  user,
} from "@/server/db/schema";
import {
  dispatchCareNotification,
  getCareNotificationPreferences,
  getUserCareNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateCareNotificationPreferences,
} from "@/server/services/care-notifications";
import { getAdminCareAccessLogs } from "@/server/queries/care-notes-documents";

test("Care Notifications Integration: preferences CRUD and event-type opt-outs", async () => {
  const [testUser] = await db
    .insert(user)
    .values({
      name: "Parent Notif Test",
      email: `parent-notif-${Date.now()}@example.test`,
      role: "USER",
      profileType: "parent",
      locale: "fr",
    })
    .returning();

  // 1. Returns defaults when no row exists yet
  const defaults = await getCareNotificationPreferences(testUser.id);
  assert.equal(defaults.inAppEnabled, true);
  assert.equal(defaults.emailEnabled, true);
  assert.equal(defaults.notifyOnMessages, true);
  assert.equal(defaults.notifyOnNotes, true);

  // 2. Update preferences: disable note notifications and in-app notifications
  const updated = await updateCareNotificationPreferences(testUser.id, {
    inAppEnabled: false,
    notifyOnNotes: false,
  });
  assert.equal(updated.inAppEnabled, false);
  assert.equal(updated.notifyOnNotes, false);
  assert.equal(updated.emailEnabled, true);

  // 3. Dispatch CARE_NOTE_SHARED: should be blocked by category opt-out (notifyOnNotes=false)
  const res1 = await dispatchCareNotification({
    recipientUserId: testUser.id,
    type: "CARE_NOTE_SHARED",
    titleFr: "Note test",
    titleAr: "ملاحظة اختبار",
    bodyFr: "Observation",
    bodyAr: "ملاحظة",
  });
  assert.equal(res1.inAppSent, false);

  // 4. Re-enable notes, but keep inAppEnabled: false -> in-app should not be sent
  await updateCareNotificationPreferences(testUser.id, {
    notifyOnNotes: true,
  });
  const res2 = await dispatchCareNotification({
    recipientUserId: testUser.id,
    type: "CARE_NOTE_SHARED",
    titleFr: "Note test 2",
    titleAr: "ملاحظة اختبار 2",
    bodyFr: "Observation 2",
    bodyAr: "ملاحظة 2",
  });
  assert.equal(res2.inAppSent, false);

  // 5. Re-enable in-app notifications -> in-app should be sent
  await updateCareNotificationPreferences(testUser.id, {
    inAppEnabled: true,
  });
  const res3 = await dispatchCareNotification({
    recipientUserId: testUser.id,
    type: "CARE_NOTE_SHARED",
    titleFr: "Note test 3",
    titleAr: "ملاحظة اختبار 3",
    bodyFr: "Observation 3",
    bodyAr: "ملاحظة 3",
    href: "/fr/parent/enfants",
  });
  assert.equal(res3.inAppSent, true);

  // Verify DB row
  const [dbNotif] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, testUser.id), eq(notifications.title, "Note test 3")));
  assert.ok(dbNotif);
  assert.equal(dbNotif.read, false);
  assert.equal(dbNotif.href, "/fr/parent/enfants");
});

test("Care Notifications Integration: read status tracking and IDOR protection", async () => {
  const [userA] = await db
    .insert(user)
    .values({
      name: "User A Notifs",
      email: `usera-notif-${Date.now()}@example.test`,
      role: "USER",
      profileType: "parent",
      locale: "fr",
    })
    .returning();

  const [userB] = await db
    .insert(user)
    .values({
      name: "User B Notifs",
      email: `userb-notif-${Date.now()}@example.test`,
      role: "USER",
      profileType: "parent",
      locale: "fr",
    })
    .returning();

  // Create notifications for User A
  const [n1] = await db
    .insert(notifications)
    .values({
      userId: userA.id,
      type: "CARE_MESSAGE_RECEIVED",
      title: "Message 1",
      body: "Nouveau message",
      read: false,
    })
    .returning();

  const [_n2] = await db
    .insert(notifications)
    .values({
      userId: userA.id,
      type: "CARE_DOCUMENT_SHARED",
      title: "Document 1",
      body: "Nouveau bilan",
      read: false,
    })
    .returning();

  // User A should have 2 unread
  const listA = await getUserCareNotifications(userA.id);
  assert.equal(listA.unreadCount, 2);
  assert.equal(listA.items.length, 2);

  // IDOR check: User B attempts to mark User A's notification as read -> fails
  const idorResult = await markNotificationAsRead(n1.id, userB.id);
  assert.equal(idorResult, false);

  // User A marks n1 as read -> succeeds
  const legitResult = await markNotificationAsRead(n1.id, userA.id);
  assert.equal(legitResult, true);

  const listAAfter1 = await getUserCareNotifications(userA.id);
  assert.equal(listAAfter1.unreadCount, 1);

  // User A marks all as read
  const markAllResult = await markAllNotificationsAsRead(userA.id);
  assert.equal(markAllResult, 1);

  const listAAfterAll = await getUserCareNotifications(userA.id);
  assert.equal(listAAfterAll.unreadCount, 0);
});

test("Care Notifications Integration: admin care access logs query", async () => {
  const [actor] = await db
    .insert(user)
    .values({
      name: "Specialist Actor",
      email: `actor-${Date.now()}@example.test`,
      role: "USER",
      profileType: "specialist",
      locale: "fr",
    })
    .returning();

  const [child] = await db
    .insert(user)
    .values({
      name: "Child Target",
      email: `child-${Date.now()}@example.test`,
      role: "USER",
      profileType: "learner",
      locale: "fr",
    })
    .returning();

  // Insert a care access log
  await db.insert(careAccessLog).values({
    actorUserId: actor.id,
    studentId: child.id,
    resourceType: "SESSION_NOTE",
    resourceId: "test-note-123",
    action: "READ",
  });

  const logs = await getAdminCareAccessLogs(20);
  assert.ok(logs.length > 0);
  const found = logs.find((l) => l.actorUserId === actor.id && l.resourceId === "test-note-123");
  assert.ok(found);
  assert.equal(found.actorName, "Specialist Actor");
  assert.equal(found.resourceType, "SESSION_NOTE");
  assert.equal(found.action, "READ");
});
