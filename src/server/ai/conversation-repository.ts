import "server-only";
import { db } from "@/server/db";
import { aiConversation, aiMessage } from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { ConversationRepository, AiMessage } from "./contracts";

const MAX_MESSAGES_PER_CONVERSATION = 100;
const MAX_MESSAGE_LENGTH = 8000;

export class DrizzleConversationRepository implements ConversationRepository {
  async append(input: { conversationId: string; userId: string; message: AiMessage }): Promise<void> {
    const { conversationId, userId, message } = input;

    if (message.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    await db.transaction(async (tx: any) => {
      const [conv] = await tx
        .select({ id: aiConversation.id })
        .from(aiConversation)
        .where(and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)))
        .limit(1);

      if (!conv) {
        throw new Error("Conversation not found or access denied");
      }

      await tx.insert(aiMessage).values({
        conversationId,
        role: message.role,
        content: message.content,
        createdAt: new Date(),
      });

      await tx
        .update(aiConversation)
        .set({ updatedAt: new Date() })
        .where(eq(aiConversation.id, conversationId));
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  async list(input: { conversationId: string; userId: string; limit?: number }): Promise<AiMessage[]> {
    const { conversationId, userId, limit = 50 } = input;
    const safeLimit = Math.min(Math.max(1, limit), MAX_MESSAGES_PER_CONVERSATION);

    const [conv] = await db
      .select({ id: aiConversation.id })
      .from(aiConversation)
      .where(and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)))
      .limit(1);

    if (!conv) {
      throw new Error("Conversation not found or access denied");
    }

    const messages = await db
      .select({ role: aiMessage.role, content: aiMessage.content })
      .from(aiMessage)
      .where(eq(aiMessage.conversationId, conversationId))
      .orderBy(desc(aiMessage.createdAt))
      .limit(safeLimit);

    return messages
      .reverse()
      .map((m) => ({ role: m.role as AiMessage["role"], content: m.content }));
  }

  async createConversation(userId: string, organizationId?: string | null, title?: string): Promise<string> {
    const [conv] = await db
      .insert(aiConversation)
      .values({
        userId,
        organizationId: organizationId ?? null,
        title: title ?? null,
        status: "ACTIVE",
      })
      .returning({ id: aiConversation.id });

    return conv.id;
  }

  async getConversation(conversationId: string, userId: string) {
    const [conv] = await db
      .select()
      .from(aiConversation)
      .where(and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)))
      .limit(1);
    return conv;
  }

  async listConversations(userId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    return db
      .select()
      .from(aiConversation)
      .where(and(eq(aiConversation.userId, userId), eq(aiConversation.status, "ACTIVE")))
      .orderBy(desc(aiConversation.updatedAt))
      .limit(safeLimit);
  }

  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    await db
      .update(aiConversation)
      .set({ status: "ARCHIVED", updatedAt: new Date() })
      .where(and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)));
  }
}

export class TestConversationRepository implements ConversationRepository {
  private conversations: Map<string, { userId: string; messages: AiMessage[] }> = new Map();

  async append(input: { conversationId: string; userId: string; message: AiMessage }): Promise<void> {
    const { conversationId, userId, message } = input;
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) {
      throw new Error("Conversation not found or access denied");
    }
    conv.messages.push(message);
  }

  async list(input: { conversationId: string; userId: string; limit?: number }): Promise<AiMessage[]> {
    const { conversationId, userId, limit = 50 } = input;
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) {
      throw new Error("Conversation not found or access denied");
    }
    return conv.messages.slice(-limit);
  }

  async createConversation(userId: string, _organizationId?: string | null, _title?: string): Promise<string> {
    const id = crypto.randomUUID();
    this.conversations.set(id, { userId, messages: [] });
    return id;
  }

  async getConversation(conversationId: string, userId: string) {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) {
      return undefined;
    }
    return { id: conversationId, userId, organizationId: null, title: null, status: "ACTIVE" };
  }

  createTestConversation(userId: string, conversationId: string, messages: AiMessage[] = []): void {
    this.conversations.set(conversationId, { userId, messages });
  }
}

import crypto from "node:crypto";

let conversationRepositoryInstance: ConversationRepository | null = null;

export function getConversationRepository(): ConversationRepository {
  if (!conversationRepositoryInstance) {
    conversationRepositoryInstance = new DrizzleConversationRepository();
  }
  return conversationRepositoryInstance;
}

export function setConversationRepository(repo: ConversationRepository): void {
  conversationRepositoryInstance = repo;
}