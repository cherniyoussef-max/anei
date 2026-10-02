import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  careConversation,
  careConversationParticipant,
  careMessage,
  personaMembership,
  specialistProfile,
  user,
  userProfile,
} from "@/server/db/schema";
import { calculateChildAge } from "@/server/queries/care-relationships";
import { markCareConversationRead } from "@/server/services/care-messaging";

export type CareConversationListItem = {
  id: string;
  status: "OPEN" | "READ_ONLY";
  lastMessageAt: Date | null;
  unreadCount: number;
  lastMessagePreview: string | null;
  child: {
    id: string;
    firstName: string;
    age: number | null;
  };
  counterparty: {
    id: string;
    name: string;
    role: "SPECIALIST" | "PARENT";
    specialty: string | null;
    avatarUrl: string | null;
  };
};

export type CareMessageItem = {
  id: string;
  senderUserId: string;
  senderName: string;
  content: string;
  status: "SENT" | "DELIVERED" | "READ";
  createdAt: Date;
  isMine: boolean;
};

/**
 * Lists all care conversations for the authenticated user (specialist or parent).
 * Strictly scoped to conversations where caller is a registered participant.
 */
export async function getCareConversationsForUser(
  callerUserId: string,
): Promise<CareConversationListItem[]> {
  // 1. Fetch conversations where caller is participant
  const callerParticipations = await db
    .select({
      conversationId: careConversationParticipant.conversationId,
      callerRole: careConversationParticipant.role,
      lastReadAt: careConversationParticipant.lastReadAt,
      conversationStatus: careConversation.status,
      lastMessageAt: careConversation.lastMessageAt,
      createdAt: careConversation.createdAt,
      studentUserId: careConversation.studentUserId,
      specialistUserId: careConversation.specialistUserId,
      studentName: user.name,
      studentFirstName: userProfile.firstName,
      studentBirthDate: userProfile.birthDate,
      studentBirthYear: userProfile.birthYear,
    })
    .from(careConversationParticipant)
    .innerJoin(
      careConversation,
      eq(careConversation.id, careConversationParticipant.conversationId),
    )
    .innerJoin(user, eq(user.id, careConversation.studentUserId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(careConversationParticipant.userId, callerUserId))
    .orderBy(desc(sql`coalesce(${careConversation.lastMessageAt}, ${careConversation.createdAt})`));

  if (callerParticipations.length === 0) return [];

  const conversationIds = callerParticipations.map((p) => p.conversationId);

  // 2. Fetch all other participants in these conversations
  const otherParticipants = await db
    .select({
      conversationId: careConversationParticipant.conversationId,
      userId: careConversationParticipant.userId,
      role: careConversationParticipant.role,
      name: user.name,
      image: user.image,
      specialty: specialistProfile.specialty,
      avatarUrl: specialistProfile.avatarUrl,
    })
    .from(careConversationParticipant)
    .innerJoin(user, eq(user.id, careConversationParticipant.userId))
    .leftJoin(
      personaMembership,
      and(
        eq(personaMembership.userId, user.id),
        eq(personaMembership.persona, "SPECIALIST"),
      ),
    )
    .leftJoin(
      specialistProfile,
      eq(specialistProfile.personaMembershipId, personaMembership.id),
    )
    .where(
      and(
        inArray(careConversationParticipant.conversationId, conversationIds),
        ne(careConversationParticipant.userId, callerUserId),
      ),
    );

  const counterpartyByConv = new Map<
    string,
    {
      id: string;
      name: string;
      role: "SPECIALIST" | "PARENT";
      specialty: string | null;
      avatarUrl: string | null;
    }
  >();

  for (const op of otherParticipants) {
    counterpartyByConv.set(op.conversationId, {
      id: op.userId,
      name: op.name ?? "Utilisateur",
      role: op.role as "SPECIALIST" | "PARENT",
      specialty: op.specialty,
      avatarUrl: op.avatarUrl || op.image,
    });
  }

  // 3. Fetch latest messages and unread counts for each conversation
  const results: CareConversationListItem[] = [];

  for (const cp of callerParticipations) {
    const counterparty = counterpartyByConv.get(cp.conversationId) ?? {
      id: "unknown",
      name: "Correspondant",
      role: cp.callerRole === "SPECIALIST" ? "PARENT" : "SPECIALIST",
      specialty: null,
      avatarUrl: null,
    };

    // Latest message
    const [latestMsg] = await db
      .select({
        content: careMessage.content,
        createdAt: careMessage.createdAt,
      })
      .from(careMessage)
      .where(eq(careMessage.conversationId, cp.conversationId))
      .orderBy(desc(careMessage.createdAt))
      .limit(1);

    // Unread count: messages sent by others after caller's lastReadAt
    const unreadCondition = [
      eq(careMessage.conversationId, cp.conversationId),
      ne(careMessage.senderUserId, callerUserId),
    ];
    if (cp.lastReadAt) {
      unreadCondition.push(sql`${careMessage.createdAt} > ${cp.lastReadAt}`);
    }

    const [unreadCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(careMessage)
      .where(and(...unreadCondition));

    const childFirstName =
      cp.studentFirstName ||
      (cp.studentName ? cp.studentName.split(" ")[0] : "Enfant");
    const childAge = calculateChildAge(cp.studentBirthDate, cp.studentBirthYear);

    results.push({
      id: cp.conversationId,
      status: cp.conversationStatus as "OPEN" | "READ_ONLY",
      lastMessageAt: cp.lastMessageAt,
      unreadCount: unreadCountRow?.count ?? 0,
      lastMessagePreview: latestMsg
        ? latestMsg.content.length > 80
          ? `${latestMsg.content.slice(0, 80)}…`
          : latestMsg.content
        : null,
      child: {
        id: cp.studentUserId,
        firstName: childFirstName,
        age: childAge,
      },
      counterparty,
    });
  }

  return results;
}

/**
 * Fetches messages for a conversation and marks unread messages as read.
 * Returns null if caller is NOT a participant (zero IDOR).
 */
export async function getCareMessages(
  callerUserId: string,
  conversationId: string,
  limit = 50,
) {
  // 1. Verify caller is participant
  const [callerParticipant] = await db
    .select({
      id: careConversationParticipant.id,
      role: careConversationParticipant.role,
    })
    .from(careConversationParticipant)
    .where(
      and(
        eq(careConversationParticipant.conversationId, conversationId),
        eq(careConversationParticipant.userId, callerUserId),
      ),
    )
    .limit(1);

  if (!callerParticipant) {
    return null;
  }

  // 2. Fetch conversation metadata
  const [conv] = await db
    .select({
      id: careConversation.id,
      status: careConversation.status,
      careRelationshipId: careConversation.careRelationshipId,
      studentUserId: careConversation.studentUserId,
      specialistUserId: careConversation.specialistUserId,
      studentName: user.name,
      studentFirstName: userProfile.firstName,
      studentBirthDate: userProfile.birthDate,
      studentBirthYear: userProfile.birthYear,
    })
    .from(careConversation)
    .innerJoin(user, eq(user.id, careConversation.studentUserId))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(careConversation.id, conversationId))
    .limit(1);

  if (!conv) return null;

  // Counterparty
  const [counterpartyRow] = await db
    .select({
      userId: careConversationParticipant.userId,
      role: careConversationParticipant.role,
      name: user.name,
      image: user.image,
      specialty: specialistProfile.specialty,
      avatarUrl: specialistProfile.avatarUrl,
    })
    .from(careConversationParticipant)
    .innerJoin(user, eq(user.id, careConversationParticipant.userId))
    .leftJoin(
      personaMembership,
      and(
        eq(personaMembership.userId, user.id),
        eq(personaMembership.persona, "SPECIALIST"),
      ),
    )
    .leftJoin(
      specialistProfile,
      eq(specialistProfile.personaMembershipId, personaMembership.id),
    )
    .where(
      and(
        eq(careConversationParticipant.conversationId, conversationId),
        ne(careConversationParticipant.userId, callerUserId),
      ),
    )
    .limit(1);

  // 3. Fetch messages (ordered ASC for display)
  const safeLimit = Math.min(100, Math.max(1, limit));
  const rawMessages = await db
    .select({
      id: careMessage.id,
      senderUserId: careMessage.senderUserId,
      content: careMessage.content,
      status: careMessage.status,
      createdAt: careMessage.createdAt,
      senderName: user.name,
    })
    .from(careMessage)
    .innerJoin(user, eq(user.id, careMessage.senderUserId))
    .where(eq(careMessage.conversationId, conversationId))
    .orderBy(desc(careMessage.createdAt))
    .limit(safeLimit);

  const messages: CareMessageItem[] = rawMessages
    .reverse()
    .map((m) => ({
      id: m.id,
      senderUserId: m.senderUserId,
      senderName: m.senderName ?? "Utilisateur",
      content: m.content,
      status: m.status as "SENT" | "DELIVERED" | "READ",
      createdAt: m.createdAt,
      isMine: m.senderUserId === callerUserId,
    }));

  // 4. Mark conversation as read asynchronously
  await markCareConversationRead(callerUserId, conversationId).catch(() => undefined);

  const childFirstName =
    conv.studentFirstName ||
    (conv.studentName ? conv.studentName.split(" ")[0] : "Enfant");
  const childAge = calculateChildAge(conv.studentBirthDate, conv.studentBirthYear);

  return {
    conversation: {
      id: conv.id,
      status: conv.status as "OPEN" | "READ_ONLY",
      careRelationshipId: conv.careRelationshipId,
      child: {
        id: conv.studentUserId,
        firstName: childFirstName,
        age: childAge,
      },
      counterparty: counterpartyRow
        ? {
            id: counterpartyRow.userId,
            name: counterpartyRow.name ?? "Correspondant",
            role: counterpartyRow.role as "SPECIALIST" | "PARENT",
            specialty: counterpartyRow.specialty,
            avatarUrl: counterpartyRow.avatarUrl || counterpartyRow.image,
          }
        : null,
    },
    messages,
  };
}
