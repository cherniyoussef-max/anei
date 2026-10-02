import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  careNotificationPreference,
  notifications,
  user,
} from "@/server/db/schema";
import { sendCareAlertEmail } from "@/server/services/mailer";
import { logger } from "@/server/security/logger";
import type { Locale } from "@/types";

export type CareNotificationType =
  | "CARE_REQUEST_RECEIVED"
  | "CARE_REQUEST_ACCEPTED"
  | "CARE_REQUEST_DECLINED"
  | "CARE_RELATIONSHIP_ENDED"
  | "CARE_NOTE_SHARED"
  | "CARE_NOTE_ADDENDUM"
  | "CARE_DOCUMENT_SHARED"
  | "CARE_MESSAGE_RECEIVED";

export type CareNotificationPreferences = {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
  notifyOnMessages: boolean;
  notifyOnNotes: boolean;
  notifyOnDocuments: boolean;
  notifyOnRequests: boolean;
};

export const DEFAULT_CARE_NOTIFICATION_PREFERENCES: CareNotificationPreferences = {
  emailEnabled: true,
  whatsappEnabled: false,
  inAppEnabled: true,
  notifyOnMessages: true,
  notifyOnNotes: true,
  notifyOnDocuments: true,
  notifyOnRequests: true,
};

export type CareNotificationInput = {
  recipientUserId: string;
  type: CareNotificationType;
  titleFr: string;
  titleAr: string;
  bodyFr: string;
  bodyAr: string;
  href?: string;
  ctaTextFr?: string;
  ctaTextAr?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Returns the care notification preferences for a given user, falling back to defaults.
 */
export async function getCareNotificationPreferences(
  userId: string,
): Promise<CareNotificationPreferences> {
  const [row] = await db
    .select({
      emailEnabled: careNotificationPreference.emailEnabled,
      whatsappEnabled: careNotificationPreference.whatsappEnabled,
      inAppEnabled: careNotificationPreference.inAppEnabled,
      notifyOnMessages: careNotificationPreference.notifyOnMessages,
      notifyOnNotes: careNotificationPreference.notifyOnNotes,
      notifyOnDocuments: careNotificationPreference.notifyOnDocuments,
      notifyOnRequests: careNotificationPreference.notifyOnRequests,
    })
    .from(careNotificationPreference)
    .where(eq(careNotificationPreference.userId, userId))
    .limit(1);

  if (!row) {
    return { ...DEFAULT_CARE_NOTIFICATION_PREFERENCES };
  }

  return {
    emailEnabled: row.emailEnabled,
    whatsappEnabled: row.whatsappEnabled,
    inAppEnabled: row.inAppEnabled,
    notifyOnMessages: row.notifyOnMessages,
    notifyOnNotes: row.notifyOnNotes,
    notifyOnDocuments: row.notifyOnDocuments,
    notifyOnRequests: row.notifyOnRequests,
  };
}

/**
 * Updates or creates care notification preferences for a user.
 */
export async function updateCareNotificationPreferences(
  userId: string,
  input: Partial<CareNotificationPreferences>,
): Promise<CareNotificationPreferences> {
  const current = await getCareNotificationPreferences(userId);
  const updated: CareNotificationPreferences = {
    emailEnabled: input.emailEnabled !== undefined ? Boolean(input.emailEnabled) : current.emailEnabled,
    whatsappEnabled: input.whatsappEnabled !== undefined ? Boolean(input.whatsappEnabled) : current.whatsappEnabled,
    inAppEnabled: input.inAppEnabled !== undefined ? Boolean(input.inAppEnabled) : current.inAppEnabled,
    notifyOnMessages: input.notifyOnMessages !== undefined ? Boolean(input.notifyOnMessages) : current.notifyOnMessages,
    notifyOnNotes: input.notifyOnNotes !== undefined ? Boolean(input.notifyOnNotes) : current.notifyOnNotes,
    notifyOnDocuments: input.notifyOnDocuments !== undefined ? Boolean(input.notifyOnDocuments) : current.notifyOnDocuments,
    notifyOnRequests: input.notifyOnRequests !== undefined ? Boolean(input.notifyOnRequests) : current.notifyOnRequests,
  };

  await db
    .insert(careNotificationPreference)
    .values({
      userId,
      ...updated,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [careNotificationPreference.userId],
      set: {
        ...updated,
        updatedAt: new Date(),
      },
    });

  return updated;
}

/**
 * Dispatches a care notification across active channels (in-app, email, WhatsApp)
 * based on recipient user preferences and notification category.
 */
export async function dispatchCareNotification(input: CareNotificationInput): Promise<{
  inAppSent: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
}> {
  const prefs = await getCareNotificationPreferences(input.recipientUserId);

  // Check category-level opt-outs
  let categoryAllowed = true;
  if (input.type === "CARE_MESSAGE_RECEIVED" && !prefs.notifyOnMessages) {
    categoryAllowed = false;
  } else if (
    (input.type === "CARE_NOTE_SHARED" || input.type === "CARE_NOTE_ADDENDUM") &&
    !prefs.notifyOnNotes
  ) {
    categoryAllowed = false;
  } else if (input.type === "CARE_DOCUMENT_SHARED" && !prefs.notifyOnDocuments) {
    categoryAllowed = false;
  } else if (
    (input.type === "CARE_REQUEST_RECEIVED" ||
      input.type === "CARE_REQUEST_ACCEPTED" ||
      input.type === "CARE_REQUEST_DECLINED" ||
      input.type === "CARE_RELATIONSHIP_ENDED") &&
    !prefs.notifyOnRequests
  ) {
    categoryAllowed = false;
  }

  if (!categoryAllowed) {
    return { inAppSent: false, emailSent: false, whatsappSent: false };
  }

  // Look up recipient user information
  const [recipient] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
    })
    .from(user)
    .where(eq(user.id, input.recipientUserId))
    .limit(1);

  if (!recipient) {
    return { inAppSent: false, emailSent: false, whatsappSent: false };
  }

  const isAr = recipient.locale === "ar";
  const title = isAr ? input.titleAr : input.titleFr;
  const body = isAr ? input.bodyAr : input.bodyFr;
  const ctaText = isAr
    ? input.ctaTextAr ?? "عرض التفاصيل"
    : input.ctaTextFr ?? "Consulter";

  let inAppSent = false;
  let emailSent = false;
  const whatsappSent = false;

  // 1. In-App Notification
  if (prefs.inAppEnabled) {
    try {
      await db.insert(notifications).values({
        userId: recipient.id,
        type: input.type,
        title,
        body,
        href: input.href,
        read: false,
      });
      inAppSent = true;
    } catch (err) {
      logger.error("care_notification.in_app_failed", {
        recipientUserId: recipient.id,
        error: String(err),
      });
    }
  }

  // 2. Transactional Email Notification
  if (prefs.emailEnabled && recipient.email) {
    try {
      await sendCareAlertEmail({
        name: recipient.name,
        email: recipient.email,
        title,
        body,
        ctaText,
        ctaUrl: input.href ? `${process.env.NEXT_PUBLIC_APP_URL || ""}${input.href}` : undefined,
        locale: (recipient.locale === "ar" ? "ar" : "fr") as Locale,
      });
      emailSent = true;
    } catch (err) {
      logger.error("care_notification.email_failed", {
        recipientUserId: recipient.id,
        error: String(err),
      });
    }
  }

  return { inAppSent, emailSent, whatsappSent };
}

/**
 * Returns notifications for a given user with unread counts.
 */
export async function getUserCareNotifications(
  userId: string,
  limit = 30,
) {
  const [unreadCountResult] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      read: notifications.read,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(100, Math.max(1, limit)));

  return {
    unreadCount: unreadCountResult?.value ?? 0,
    items: rows,
  };
}

/**
 * Marks a single notification as read, strictly scoped to caller's user id (no IDOR).
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });

  return result.length > 0;
}

/**
 * Marks all notifications as read for a given user.
 */
export async function markAllNotificationsAsRead(
  userId: string,
): Promise<number> {
  const result = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .returning({ id: notifications.id });

  return result.length;
}
