import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql, count } from "drizzle-orm";
import { db } from "@/server/db";
import {
  crmThreads,
  crmMessages,
  crmLeadAttribution,
  user,
  userProfile,
  crmContact,
  enrollments,
  courses,
  avsBookingRequests,
  type CrmThreadRow,
} from "@/server/db/schema";
import { getPrimaryOrganization } from "@/server/queries/organizations";

export type OmnichannelChannel = "WHATSAPP" | "INSTAGRAM" | "MESSENGER";
export type OmnichannelPipelineStage =
  | "NEW_AD_LEAD"
  | "QUALIFIED"
  | "INTERESTED_IN_COURSE"
  | "BOOKING_AVS_SPECIALIST"
  | "CONVERTED_PAID"
  | "ARCHIVED";

export type MetaAdReferralPayload = {
  source_type?: string;
  source_id?: string;
  source_url?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  ctwa_clid?: string;
  ref?: string;
  source?: string;
  type?: string;
  ad_id?: string;
  campaign_id?: string;
  ads_context_data?: {
    ad_title?: string;
    photo_url?: string;
    video_url?: string;
    post_id?: string;
  };
  [key: string]: unknown;
};

export type IngestOmnichannelMessageInput = {
  channel: OmnichannelChannel;
  externalContactId: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  avatarUrl?: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  messageType?: "TEXT" | "TEMPLATE" | "AUDIO" | "IMAGE" | "DOCUMENT" | "INTERACTIVE_BUTTON";
  metaMessageId?: string;
  deliveryStatus?: "SENT" | "DELIVERED" | "READ" | "FAILED";
  referral?: MetaAdReferralPayload | null;
  organizationId?: string;
  sentByAdminId?: string;
};

/**
 * Ingest an incoming or outgoing message from WhatsApp, Instagram, or Messenger
 * with automatic Meta Ads lead attribution and user profile reconciliation.
 */
export async function ingestOmnichannelMessage(input: IngestOmnichannelMessageInput) {
  let orgId = input.organizationId;
  if (!orgId) {
    const org = await getPrimaryOrganization();
    orgId = org?.id;
  }

  const cleanExternalId = input.externalContactId.trim();
  const cleanContent = input.content.trim().slice(0, 10000);

  // 1. Check if thread already exists
  const existingThread = await db
    .select()
    .from(crmThreads)
    .where(
      and(
        eq(crmThreads.channel, input.channel),
        eq(crmThreads.externalContactId, cleanExternalId),
        orgId ? eq(crmThreads.organizationId, orgId) : undefined
      )
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  // 2. Identify Meta Ads attribution if referral payload is provided
  let hasAdReferral = false;
  let sourceType: CrmThreadRow["sourceType"] = existingThread?.sourceType ?? "ORGANIC";
  let adId: string | null = existingThread?.adId ?? null;
  let campaignId: string | null = existingThread?.campaignId ?? null;
  let adHeadline: string | null = existingThread?.adHeadline ?? null;
  let adBody: string | null = existingThread?.adBody ?? null;
  let sourceUrl: string | null = existingThread?.sourceUrl ?? null;
  let ctwaClid: string | null = existingThread?.ctwaClid ?? null;

  if (input.referral && Object.keys(input.referral).length > 0) {
    hasAdReferral = true;
    if (input.channel === "WHATSAPP") {
      sourceType = "META_CLICK_TO_WHATSAPP";
    } else if (input.channel === "INSTAGRAM") {
      sourceType = "META_IG_AD";
    } else {
      sourceType = "META_MESSENGER_AD";
    }

    adId = input.referral.source_id || input.referral.ad_id || null;
    campaignId = input.referral.campaign_id || null;
    adHeadline =
      input.referral.headline ||
      input.referral.ads_context_data?.ad_title ||
      null;
    adBody = input.referral.body || null;
    sourceUrl = input.referral.source_url || null;
    ctwaClid = input.referral.ctwa_clid || null;
  }

  // 3. User Linking (by phone or email if not already linked)
  let linkedUserId = existingThread?.linkedUserId ?? null;
  let linkedContactId = existingThread?.linkedContactId ?? null;

  if (!linkedUserId) {
    if (input.channel === "WHATSAPP" || input.contactPhone) {
      const phoneLookup = (input.contactPhone || cleanExternalId).replace(/\D/g, "");
      if (phoneLookup.length >= 8) {
        // Look up user profile with phone
        const matchedProfile = await db
          .select({ userId: userProfile.userId })
          .from(userProfile)
          .where(ilike(userProfile.phoneNumber, `%${phoneLookup.slice(-8)}%`))
          .limit(1)
          .then((r) => r[0]);

        if (matchedProfile) {
          linkedUserId = matchedProfile.userId;
        }
      }
    }

    if (!linkedUserId && input.contactEmail) {
      const matchedUser = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.contactEmail.trim().toLowerCase()))
        .limit(1)
        .then((r) => r[0]);

      if (matchedUser) {
        linkedUserId = matchedUser.id;
      }
    }
  }

  // 4. Contact CRM Linking
  if (!linkedContactId && (input.contactPhone || cleanExternalId) && orgId) {
    const matchedContact = await db
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(
        and(
          eq(crmContact.organizationId, orgId),
          or(
            ilike(crmContact.phone, `%${cleanExternalId.slice(-8)}%`),
            input.contactEmail ? eq(crmContact.email, input.contactEmail.trim().toLowerCase()) : undefined
          )
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (matchedContact) {
      linkedContactId = matchedContact.id;
    }
  }

  const now = new Date();

  // 5. Atomic Thread & Message Write
  const result = await db.transaction(async (tx) => {
    let threadId = existingThread?.id;

    if (!threadId) {
      const [newThread] = await tx
        .insert(crmThreads)
        .values({
          organizationId: orgId,
          channel: input.channel,
          externalContactId: cleanExternalId,
          contactName: input.contactName?.trim() || cleanExternalId,
          contactEmail: input.contactEmail?.trim() || null,
          contactPhone: input.contactPhone?.trim() || (input.channel === "WHATSAPP" ? cleanExternalId : null),
          avatarUrl: input.avatarUrl || null,
          linkedUserId,
          linkedContactId,
          sourceType,
          adId,
          campaignId,
          adHeadline,
          adBody,
          sourceUrl,
          ctwaClid,
          metaAdReferral: input.referral || {},
          pipelineStage: "NEW_AD_LEAD",
          unreadCount: input.direction === "INBOUND" ? 1 : 0,
          lastMessageAt: now,
          lastMessagePreview: cleanContent.slice(0, 160),
          lastMessageDirection: input.direction,
          updatedAt: now,
        })
        .returning();

      threadId = newThread.id;
    } else {
      await tx
        .update(crmThreads)
        .set({
          contactName: input.contactName?.trim() || existingThread.contactName,
          contactEmail: input.contactEmail?.trim() || existingThread.contactEmail,
          contactPhone: input.contactPhone?.trim() || existingThread.contactPhone,
          avatarUrl: input.avatarUrl || existingThread.avatarUrl,
          linkedUserId: linkedUserId || existingThread.linkedUserId,
          linkedContactId: linkedContactId || existingThread.linkedContactId,
          sourceType: hasAdReferral ? sourceType : existingThread.sourceType,
          adId: hasAdReferral ? adId : existingThread.adId,
          campaignId: hasAdReferral ? campaignId : existingThread.campaignId,
          adHeadline: hasAdReferral ? adHeadline : existingThread.adHeadline,
          adBody: hasAdReferral ? adBody : existingThread.adBody,
          sourceUrl: hasAdReferral ? sourceUrl : existingThread.sourceUrl,
          ctwaClid: hasAdReferral ? ctwaClid : existingThread.ctwaClid,
          metaAdReferral: hasAdReferral ? input.referral || {} : existingThread.metaAdReferral,
          unreadCount:
            input.direction === "INBOUND"
              ? existingThread.unreadCount + 1
              : existingThread.unreadCount,
          lastMessageAt: now,
          lastMessagePreview: cleanContent.slice(0, 160),
          lastMessageDirection: input.direction,
          updatedAt: now,
        })
        .where(eq(crmThreads.id, threadId));
    }

    // Insert Message
    const [msg] = await tx
      .insert(crmMessages)
      .values({
        threadId,
        direction: input.direction,
        messageType: input.messageType || "TEXT",
        content: cleanContent,
        metaMessageId: input.metaMessageId || null,
        deliveryStatus: input.deliveryStatus || "SENT",
        sentByAdminId: input.sentByAdminId || null,
        metadata: input.referral ? { referral: input.referral } : {},
        createdAt: now,
      })
      .returning();

    // If new ad referral, record lead attribution
    if (hasAdReferral) {
      await tx.insert(crmLeadAttribution).values({
        threadId,
        userId: linkedUserId,
        channel: input.channel,
        sourceType,
        adId,
        campaignId,
        adHeadline,
        adBody,
        sourceUrl,
        ctwaClid,
        payload: input.referral || {},
        createdAt: now,
      });
    }

    return {
      threadId,
      messageId: msg.id,
      isNewThread: !existingThread,
      hasAdReferral,
    };
  });

  return result;
}

/**
 * Update message delivery status from Meta Webhook status event (DELIVERED, READ, FAILED)
 */
export async function updateOmnichannelMessageStatus(
  metaMessageId: string,
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | "FAILED"
) {
  if (!metaMessageId) return null;
  const [updated] = await db
    .update(crmMessages)
    .set({ deliveryStatus })
    .where(eq(crmMessages.metaMessageId, metaMessageId))
    .returning();
  return updated ?? null;
}

/**
 * List threads with flexible filtering (all, unread, meta ads, registered users)
 */
export async function listOmnichannelThreads(options: {
  channel?: OmnichannelChannel | "ALL";
  filter?: "all" | "unread" | "meta_ads" | "registered_users";
  pipelineStage?: OmnichannelPipelineStage;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 30));
  const offset = (page - 1) * pageSize;

  const filters = [];

  if (options.channel && options.channel !== "ALL") {
    filters.push(eq(crmThreads.channel, options.channel));
  }

  if (options.pipelineStage) {
    filters.push(eq(crmThreads.pipelineStage, options.pipelineStage));
  }

  if (options.filter === "unread") {
    filters.push(sql`${crmThreads.unreadCount} > 0`);
  } else if (options.filter === "meta_ads") {
    filters.push(
      inArray(crmThreads.sourceType, [
        "META_CLICK_TO_WHATSAPP",
        "META_IG_AD",
        "META_MESSENGER_AD",
      ])
    );
  } else if (options.filter === "registered_users") {
    filters.push(isNotNull(crmThreads.linkedUserId));
  }

  if (options.q && options.q.trim()) {
    const pattern = `%${options.q.trim()}%`;
    filters.push(
      or(
        ilike(crmThreads.contactName, pattern),
        ilike(crmThreads.externalContactId, pattern),
        ilike(crmThreads.contactPhone, pattern),
        ilike(crmThreads.contactEmail, pattern),
        ilike(crmThreads.adHeadline, pattern),
        ilike(crmThreads.lastMessagePreview, pattern)
      )!
    );
  }

  const whereClause = filters.length ? and(...filters) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(crmThreads)
    .where(whereClause);

  const total = Number(totalRow?.count ?? 0);

  const threads = await db
    .select({
      id: crmThreads.id,
      channel: crmThreads.channel,
      externalContactId: crmThreads.externalContactId,
      contactName: crmThreads.contactName,
      contactEmail: crmThreads.contactEmail,
      contactPhone: crmThreads.contactPhone,
      avatarUrl: crmThreads.avatarUrl,
      linkedUserId: crmThreads.linkedUserId,
      sourceType: crmThreads.sourceType,
      adId: crmThreads.adId,
      campaignId: crmThreads.campaignId,
      adHeadline: crmThreads.adHeadline,
      ctwaClid: crmThreads.ctwaClid,
      pipelineStage: crmThreads.pipelineStage,
      unreadCount: crmThreads.unreadCount,
      lastMessageAt: crmThreads.lastMessageAt,
      lastMessagePreview: crmThreads.lastMessagePreview,
      lastMessageDirection: crmThreads.lastMessageDirection,
      assignedAdminId: crmThreads.assignedAdminId,
      createdAt: crmThreads.createdAt,
    })
    .from(crmThreads)
    .where(whereClause)
    .orderBy(desc(crmThreads.lastMessageAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items: threads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Get comprehensive 360° detail for a single thread
 */
export async function getOmnichannelThreadDetail(threadId: string) {
  const thread = await db
    .select()
    .from(crmThreads)
    .where(eq(crmThreads.id, threadId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!thread) return null;

  // Mark unread as 0 on view
  if (thread.unreadCount > 0) {
    await db
      .update(crmThreads)
      .set({ unreadCount: 0 })
      .where(eq(crmThreads.id, threadId));
  }

  // Get conversation messages
  const messages = await db
    .select()
    .from(crmMessages)
    .where(eq(crmMessages.threadId, threadId))
    .orderBy(asc(crmMessages.createdAt))
    .limit(200);

  // If user linked, get their enrolled courses and appointments
  let linkedUserDetail: {
    user: { id: string; name: string; email: string; role: string; profileType: string };
    enrollments: Array<{ courseId: string; courseTitle: string; progressPercent: number }>;
    bookings: Array<{ id: string; status: string; meetingType: string; requestedDate: string }>;
  } | null = null;

  if (thread.linkedUserId) {
    const [matchedUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileType: user.profileType,
      })
      .from(user)
      .where(eq(user.id, thread.linkedUserId))
      .limit(1);

    if (matchedUser) {
      const userEnrollments = await db
        .select({
          courseId: enrollments.courseId,
          courseTitle: courses.titleFr,
          progressPercent: enrollments.progressPercent,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(enrollments.userId, matchedUser.id))
        .limit(10);

      const userBookings = await db
        .select({
          id: avsBookingRequests.id,
          status: avsBookingRequests.status,
          meetingType: avsBookingRequests.meetingType,
          requestedDate: avsBookingRequests.requestedDate,
        })
        .from(avsBookingRequests)
        .where(eq(avsBookingRequests.parentUserId, matchedUser.id))
        .limit(10);

      linkedUserDetail = {
        user: matchedUser,
        enrollments: userEnrollments,
        bookings: userBookings,
      };
    }
  }

  return {
    thread: {
      ...thread,
      unreadCount: 0,
    },
    messages,
    linkedUserDetail,
  };
}

/**
 * Update the pipeline stage for a CRM thread
 */
export async function updateOmnichannelPipelineStage(
  threadId: string,
  stage: OmnichannelPipelineStage,
  adminUserId?: string
) {
  const [updated] = await db
    .update(crmThreads)
    .set({
      pipelineStage: stage,
      assignedAdminId: adminUserId || undefined,
      updatedAt: new Date(),
    })
    .where(eq(crmThreads.id, threadId))
    .returning();

  return updated ?? null;
}

/**
 * Link thread to an ANEI user account
 */
export async function linkOmnichannelThreadToUser(
  threadId: string,
  userId: string
) {
  const [targetUser] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!targetUser) return null;

  const [updated] = await db
    .update(crmThreads)
    .set({
      linkedUserId: targetUser.id,
      contactName: targetUser.name,
      contactEmail: targetUser.email,
      updatedAt: new Date(),
    })
    .where(eq(crmThreads.id, threadId))
    .returning();

  return updated ?? null;
}

/**
 * Update internal admin notes for a thread
 */
export async function updateOmnichannelThreadNotes(
  threadId: string,
  internalNotes: string
) {
  const [updated] = await db
    .update(crmThreads)
    .set({
      internalNotes: internalNotes.slice(0, 5000),
      updatedAt: new Date(),
    })
    .where(eq(crmThreads.id, threadId))
    .returning();

  return updated ?? null;
}
