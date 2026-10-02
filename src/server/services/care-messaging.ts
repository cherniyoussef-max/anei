import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  careConversation,
  careConversationParticipant,
  careMessage,
} from "@/server/db/schema";
import { dispatchCareNotification } from "@/server/services/care-notifications";

export type SendCareMessageInput = {
  callerUserId: string;
  conversationId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type SendCareMessageResult =
  | { kind: "ok"; messageId: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "conversation_read_only" }
  | { kind: "invalid_content" };

/**
 * Strips HTML markup and collapses extra whitespace to ensure safe plain text.
 */
export function sanitizePlainText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Sends a secure plain text message within an active care conversation.
 * Enforces zero IDOR (caller must be a participant), blocks sends if conversation
 * is READ_ONLY (relationship ended), and dispatches generic notifications.
 */
export async function sendCareMessage(
  input: SendCareMessageInput,
): Promise<SendCareMessageResult> {
  const sanitized = sanitizePlainText(input.content);
  if (!sanitized || sanitized.length === 0 || sanitized.length > 4000) {
    return { kind: "invalid_content" };
  }

  // 1. Check conversation existence and status
  const [conversation] = await db
    .select()
    .from(careConversation)
    .where(eq(careConversation.id, input.conversationId))
    .limit(1);

  if (!conversation) {
    return { kind: "not_found" };
  }

  if (conversation.status === "READ_ONLY") {
    return { kind: "conversation_read_only" };
  }

  // 2. Check participant membership (Zero IDOR)
  const [participant] = await db
    .select()
    .from(careConversationParticipant)
    .where(
      and(
        eq(careConversationParticipant.conversationId, input.conversationId),
        eq(careConversationParticipant.userId, input.callerUserId),
      ),
    )
    .limit(1);

  if (!participant) {
    return { kind: "forbidden" };
  }

  const now = new Date();

  return db.transaction(async (tx) => {
    // 3. Insert message
    const [created] = await tx
      .insert(careMessage)
      .values({
        conversationId: input.conversationId,
        senderUserId: input.callerUserId,
        content: sanitized,
        status: "SENT",
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // 4. Update conversation last_message_at
    await tx
      .update(careConversation)
      .set({
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(careConversation.id, input.conversationId));

    // 5. Update sender's last_read_at
    await tx
      .update(careConversationParticipant)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(careConversationParticipant.conversationId, input.conversationId),
          eq(careConversationParticipant.userId, input.callerUserId),
        ),
      );

    // 6. Find recipient participants and dispatch generic notifications
    const otherParticipants = await tx
      .select({
        userId: careConversationParticipant.userId,
        role: careConversationParticipant.role,
        mutedAt: careConversationParticipant.mutedAt,
      })
      .from(careConversationParticipant)
      .where(
        and(
          eq(careConversationParticipant.conversationId, input.conversationId),
          ne(careConversationParticipant.userId, input.callerUserId),
        ),
      );

    for (const recipient of otherParticipants) {
      // Disallow notifications if recipient muted this conversation
      if (!recipient.mutedAt) {
        const destHref =
          recipient.role === "SPECIALIST"
            ? `/specialist/messages/${input.conversationId}`
            : `/parent/messages/${input.conversationId}`;

        await dispatchCareNotification({
          recipientUserId: recipient.userId,
          type: "CARE_MESSAGE_RECEIVED",
          titleFr: "Nouveau message de suivi",
          titleAr: "رسالة متابعة جديدة",
          bodyFr: "Vous avez reçu un nouveau message dans votre espace de suivi.",
          bodyAr: "لقد تلقيتم رسالة جديدة في مساحة المتابعة والرعاية.",
          href: destHref,
        });
      }
    }

    // 7. Audit log (never log content or child name)
    await tx.insert(auditLogs).values({
      actorUserId: input.callerUserId,
      action: "care.message.send",
      entityType: "care_message",
      entityId: created.id,
      metadata: {
        conversationId: input.conversationId,
      },
    });

    return { kind: "ok", messageId: created.id };
  });
}

/**
 * Marks all incoming messages in a conversation as read by the caller.
 */
export async function markCareConversationRead(
  callerUserId: string,
  conversationId: string,
): Promise<{ ok: boolean }> {
  const [participant] = await db
    .select({ id: careConversationParticipant.id })
    .from(careConversationParticipant)
    .where(
      and(
        eq(careConversationParticipant.conversationId, conversationId),
        eq(careConversationParticipant.userId, callerUserId),
      ),
    )
    .limit(1);

  if (!participant) return { ok: false };

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(careConversationParticipant)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(careConversationParticipant.conversationId, conversationId),
          eq(careConversationParticipant.userId, callerUserId),
        ),
      );

    await tx
      .update(careMessage)
      .set({ status: "READ", updatedAt: now })
      .where(
        and(
          eq(careMessage.conversationId, conversationId),
          ne(careMessage.senderUserId, callerUserId),
          ne(careMessage.status, "READ"),
        ),
      );
  });

  return { ok: true };
}
