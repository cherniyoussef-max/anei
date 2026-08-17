import "server-only";
import { db } from "@/server/db";
import { knowledgeChunk, knowledgeDocument, organizationMembership, user } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getEmbeddingProvider } from "./embedding-provider";
import { getVectorStore } from "./vector-store";
import type { Retriever, RetrievalResult } from "./contracts";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const MIN_SCORE_THRESHOLD = 0.55;

interface SearchFilters {
  userId: string;
  organizationId?: string | null;
  courseId?: string;
  locale: "fr" | "ar";
  limit?: number;
}

export class PgVectorRetriever implements Retriever {
  async search(input: {
    query: string;
    locale: "fr" | "ar";
    userId: string;
    courseId?: string;
    limit?: number;
  }): Promise<RetrievalResult[]> {
    const { query, locale, userId, courseId, limit = DEFAULT_LIMIT } = input;
    const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

    const embeddingProvider = getEmbeddingProvider();
    const [queryEmbedding] = await embeddingProvider.embed([query]);

    const vectorStore = getVectorStore();

    const userOrgId = await this.getUserOrganizationId(userId);

    const allowedDocumentIds = await this.getAllowedDocumentIds({
      userId,
      organizationId: userOrgId,
      courseId,
      locale,
    });

    if (allowedDocumentIds.length === 0) {
      return [];
    }

    const results = await vectorStore.search({
      queryEmbedding,
      filter: { documentIds: allowedDocumentIds },
      limit: safeLimit * 2,
    });

    const filtered = results
      .filter((r) => r.score >= MIN_SCORE_THRESHOLD)
      .slice(0, safeLimit);

    return filtered.map((r) => ({
      id: r.id,
      text: r.text,
      score: r.score,
      source: r.metadata?.source as string ?? r.documentId,
      courseId: r.metadata?.courseId as string | undefined,
      resourceId: r.metadata?.resourceId as string | undefined,
    }));
  }

  private async getUserOrganizationId(userId: string): Promise<string | null> {
    const membership = await db
      .select({ organizationId: organizationMembership.organizationId })
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.userId, userId),
          eq(organizationMembership.status, "ACTIVE")
        )
      )
      .limit(1);

    return membership[0]?.organizationId ?? null;
  }

  private async getAllowedDocumentIds(filters: SearchFilters): Promise<string[]> {
    const { userId: _userId, organizationId, courseId, locale: _locale } = filters;

    const conditions = [
      eq(knowledgeDocument.status, "INDEXED"),
      sql`${knowledgeDocument.visibility} in ('PUBLIC', 'PLATFORM')`,
    ];

    if (organizationId) {
      conditions.push(eq(knowledgeDocument.organizationId, organizationId));
    }

    if (courseId) {
      conditions.push(
        sql`${knowledgeChunk.metadata}->>'courseId' = ${courseId}`
      );
    }

    const docs = await db
      .select({ id: knowledgeDocument.id })
      .from(knowledgeDocument)
      .innerJoin(knowledgeChunk, eq(knowledgeChunk.documentId, knowledgeDocument.id))
      .where(and(...conditions))
      .groupBy(knowledgeDocument.id)
      .limit(100);

    return docs.map((d) => d.id);
  }
}

export class TestRetriever implements Retriever {
  private documents: Array<{
    id: string;
    text: string;
    source: string;
    courseId?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }> = [];

  setDocuments(docs: Array<{
    id: string;
    text: string;
    source: string;
    courseId?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }>): void {
    this.documents = docs;
  }

  async search(input: {
    query: string;
    locale: "fr" | "ar";
    userId: string;
    courseId?: string;
    limit?: number;
  }): Promise<RetrievalResult[]> {
    const { limit = DEFAULT_LIMIT } = input;
    return this.documents
      .slice(0, limit)
      .map((d) => ({
        id: d.id,
        text: d.text,
        score: 0.9,
        source: d.source,
        courseId: d.courseId,
        resourceId: d.resourceId,
      }));
  }
}

let retrieverInstance: Retriever | null = null;

export function getRetriever(): Retriever {
  if (!retrieverInstance) {
    retrieverInstance = new PgVectorRetriever();
  }
  return retrieverInstance;
}

export function setRetriever(retriever: Retriever): void {
  retrieverInstance = retriever;
}